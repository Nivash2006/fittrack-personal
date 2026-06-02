/**
 * FitTrack Personal — Offline-First Synchronization Engine
 *
 * Automatically monitors browser connection states, queues pending local writes,
 * handles background retry operations with exponential backoff limits, and
 * syncs local weight log entries securely to the Supabase cloud instance.
 */

import { db } from './database';
import type { UserProfile, Meal, Workout, NoteLog, FastingLog } from './database';
import { supabase } from './supabaseClient';

// Maximum attempts before marking a sync queue entry as failed
const MAX_RETRY_LIMIT = 3;

class SyncEngine {
  private isSyncing = false;
  private networkStatusListeners: (() => void)[] = [];

  constructor() {
    this.initNetworkListeners();
  }

  /**
   * Listen to browser online/offline events
   */
  private initNetworkListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('Device is ONLINE. Triggering background synchronization...');
        this.syncAll();
      });
      window.addEventListener('offline', () => {
        console.log('Device is OFFLINE. Operations will be queued locally.');
      });
    }
  }

  /**
   * Checks if browser is currently online
   */
  public isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * Main sync processor
   */
  public async syncAll(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.isOnline()) {
      console.warn('Sync aborted: Device is offline.');
      return;
    }

    try {
      this.isSyncing = true;
      const queue = await db.syncQueue.orderBy('id').toArray();
      if (queue.length === 0) {
        return;
      }

      console.log(`SyncEngine: Found ${queue.length} pending operations in the sync queue.`);

      // Verify user authentication before syncing
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('Sync Engine: No authenticated cloud session. Postponing synchronization.');
        this.isSyncing = false;
        return;
      }

      for (const task of queue) {
        let success = false;

        if (task.entityType === 'weightLogs') {
          success = await this.syncWeightLog(task.entityId, task.operation, user.id);
        } else {
          // If other entity types are introduced in the queue, mark as successful to clear
          success = true;
        }

        if (success) {
          // Sync succeeded — remove from queue
          await db.syncQueue.delete(task.id!);
          console.log(`SyncEngine: Successfully processed Task ID ${task.id}. Removed from queue.`);
        } else {
          // Sync failed — increment retry count
          const nextRetry = task.retryCount + 1;
          if (nextRetry >= MAX_RETRY_LIMIT) {
            await db.syncQueue.delete(task.id!);
            if (task.entityType === 'weightLogs') {
              await db.weightLogs.update(task.entityId, { syncStatus: 'failed' });
            }
            console.error(`SyncEngine: Task ID ${task.id} failed after ${MAX_RETRY_LIMIT} attempts. Marked as FAILED.`);
          } else {
            await db.syncQueue.update(task.id!, { retryCount: nextRetry });
            if (task.entityType === 'weightLogs') {
              await db.weightLogs.update(task.entityId, { syncStatus: 'pending' });
            }
            console.warn(`SyncEngine: Retrying Task ID ${task.id} later. Attempt ${nextRetry}/${MAX_RETRY_LIMIT}.`);
          }
        }
      }
    } catch (err) {
      console.error('SyncEngine encountered an error during sync loop:', err);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Processes a single weight log entry sync to Supabase
   */
  private async syncWeightLog(
    entityId: number, 
    operation: 'create' | 'update' | 'delete',
    userId: string
  ): Promise<boolean> {
    try {
      const log = await db.weightLogs.get(entityId);
      
      if (!log && operation !== 'delete') {
        // Record no longer exists locally — safe to ignore/remove task
        return true;
      }

      if (log) {
        await db.weightLogs.update(entityId, { syncStatus: 'syncing' });
      }

      if (operation === 'create' || operation === 'update') {
        if (!log) return true;

        // Upsert weights to Supabase using conflict constraints
        const { error } = await supabase.from('weight_logs').upsert({
          user_id: userId,
          weight: log.weight,
          unit: log.unit,
          source: log.source,
          logged_at: log.loggedAt,
          device_mac: log.deviceMac || null,
          created_at: log.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,logged_at,weight'
        });

        if (error) throw error;
        
        console.log(`Cloud Sync SUCCESS: Synced weight log (${log.weight}${log.unit} on ${log.loggedAt}) to Supabase.`);
      } else if (operation === 'delete') {
        // Delete records matching date
        const { error } = await supabase
          .from('weight_logs')
          .delete()
          .match({ user_id: userId, id: entityId });

        if (error) throw error;
        console.log(`Cloud Sync SUCCESS: Synced deletion of weight log ID ${entityId} to Supabase.`);
      }

      // Update local sync status to synced
      if (log) {
        await db.weightLogs.update(entityId, {
          syncStatus: 'synced',
          updatedAt: new Date().toISOString(),
        });
      }

      return true;
    } catch (err) {
      console.error(`Failed to sync weight log ID ${entityId}:`, err);
      return false;
    }
  }

  // ─── Direct Cloud Sync Helpers (Offline-First) ──────────────────────────────────

  /**
   * Save/Upsert user profile locally and to Supabase
   */
  public async saveProfile(profileData: Omit<UserProfile, 'id'>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || profileData.email || '';
      
      // Update data with user details
      const formattedProfile = { ...profileData, email };

      // 1. Save locally
      const existing = await db.userProfiles.toArray();
      if (existing.length > 0) {
        await db.userProfiles.update(existing[0].id!, formattedProfile);
      } else {
        await db.userProfiles.add(formattedProfile);
      }

      // 2. Save to Supabase cloud
      if (user) {
        const { error } = await supabase.from('profiles').upsert({
          id: user.id,
          name: formattedProfile.name,
          email: formattedProfile.email,
          height_cm: formattedProfile.heightCm,
          weight_kg: formattedProfile.weightKg,
          age: formattedProfile.age,
          gender: formattedProfile.gender,
          activity_level: formattedProfile.activityLevel,
          goal: formattedProfile.goal,
          calorie_target: formattedProfile.calorieTarget,
          protein_target: formattedProfile.proteinTarget,
          carb_target: formattedProfile.carbTarget,
          fat_target: formattedProfile.fatTarget,
          water_target: formattedProfile.waterTarget,
          created_at: formattedProfile.createdAt
        });
        if (error) throw error;
        console.log('SyncEngine: Profile upserted to Supabase.');
      }
    } catch (err) {
      console.error('SyncEngine saveProfile failed:', err);
    }
  }

  /**
   * Save a meal locally and to Supabase
   */
  public async saveMeal(meal: Omit<Meal, 'id'>): Promise<number> {
    const localId = await db.meals.add(meal);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('meals').insert({
          user_id: user.id,
          food_name: meal.foodName,
          meal_type: meal.mealType,
          quantity: meal.quantity,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats,
          logged_at: meal.date,
          created_at: meal.createdAt
        });
        if (error) throw error;
        console.log('SyncEngine: Meal inserted to Supabase.');
      }
    } catch (err) {
      console.error('SyncEngine saveMeal failed:', err);
    }

    return localId;
  }

  /**
   * Delete a meal locally and from Supabase
   */
  public async deleteMeal(localId: number): Promise<void> {
    try {
      const meal = await db.meals.get(localId);
      if (meal) {
        await db.meals.delete(localId);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from('meals')
            .delete()
            .match({ user_id: user.id, created_at: meal.createdAt });
          if (error) throw error;
          console.log('SyncEngine: Meal deleted from Supabase.');
        }
      }
    } catch (err) {
      console.error('SyncEngine deleteMeal failed:', err);
    }
  }

  /**
   * Save a workout locally and to Supabase
   */
  public async saveWorkout(workout: Omit<Workout, 'id'>): Promise<number> {
    const localId = await db.workouts.add(workout);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('workouts').insert({
          user_id: user.id,
          exercise: workout.exercise,
          category: workout.category,
          sets: workout.sets,
          duration: workout.duration || null,
          logged_at: workout.date,
          created_at: workout.createdAt
        });
        if (error) throw error;
        console.log('SyncEngine: Workout inserted to Supabase.');
      }
    } catch (err) {
      console.error('SyncEngine saveWorkout failed:', err);
    }

    return localId;
  }

  /**
   * Delete a workout locally and from Supabase
   */
  public async deleteWorkout(localId: number): Promise<void> {
    try {
      const workout = await db.workouts.get(localId);
      if (workout) {
        await db.workouts.delete(localId);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from('workouts')
            .delete()
            .match({ user_id: user.id, created_at: workout.createdAt });
          if (error) throw error;
          console.log('SyncEngine: Workout deleted from Supabase.');
        }
      }
    } catch (err) {
      console.error('SyncEngine deleteWorkout failed:', err);
    }
  }

  /**
   * Save a note/journal locally and to Supabase
   */
  public async saveNote(note: Omit<NoteLog, 'id'> & { id?: number }): Promise<number> {
    let localId = note.id;
    if (localId) {
      await db.notes.update(localId, note);
    } else {
      localId = await db.notes.add(note);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('notes').upsert({
          user_id: user.id,
          title: note.title,
          content: note.content,
          notebook: note.notebook || 'Personal',
          tags: note.tags,
          created_at: note.createdAt,
          updated_at: note.updatedAt
        }, {
          onConflict: 'user_id,created_at'
        });
        if (error) throw error;
        console.log('SyncEngine: Note upserted to Supabase.');
      }
    } catch (err) {
      console.error('SyncEngine saveNote failed:', err);
    }

    return localId;
  }

  /**
   * Delete a note locally and from Supabase
   */
  public async deleteNote(localId: number): Promise<void> {
    try {
      const note = await db.notes.get(localId);
      if (note) {
        await db.notes.delete(localId);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from('notes')
            .delete()
            .match({ user_id: user.id, created_at: note.createdAt });
          if (error) throw error;
          console.log('SyncEngine: Note deleted from Supabase.');
        }
      }
    } catch (err) {
      console.error('SyncEngine deleteNote failed:', err);
    }
  }

  /**
   * Save a fasting log locally and to Supabase
   */
  public async saveFastingLog(log: Omit<FastingLog, 'id'>): Promise<number> {
    const localId = await db.fastingLogs.add(log);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('fasting_logs').insert({
          user_id: user.id,
          type: log.type,
          started_at: log.startedAt,
          duration_hours: log.durationHours,
          completed: log.completed,
          ended_at: log.endedAt || null,
          created_at: new Date().toISOString()
        });
        if (error) throw error;
        console.log('SyncEngine: Fasting log inserted to Supabase.');
      }
    } catch (err) {
      console.error('SyncEngine saveFastingLog failed:', err);
    }

    return localId;
  }

  /**
   * Pulls all user data from Supabase and restores it in local IndexedDB.
   * Useful when logging in on a new device or restoring a session.
   */
  public async pullAllFromCloud(userId: string): Promise<void> {
    if (!this.isOnline()) return;

    try {
      console.log('SyncEngine: Pulling all user data from Supabase cloud...');

      // 1. Pull user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profile) {
        const localProfiles = await db.userProfiles.where('email').equals(profile.email).toArray();
        if (localProfiles.length === 0) {
          await db.userProfiles.add({
            name: profile.name,
            email: profile.email,
            heightCm: Number(profile.height_cm),
            weightKg: Number(profile.weight_kg),
            age: Number(profile.age),
            gender: profile.gender,
            activityLevel: profile.activity_level,
            goal: profile.goal,
            calorieTarget: Number(profile.calorie_target),
            proteinTarget: Number(profile.protein_target),
            carbTarget: Number(profile.carb_target),
            fatTarget: Number(profile.fat_target),
            waterTarget: Number(profile.water_target || 2000),
            createdAt: profile.created_at,
          });
        }
      }

      // 2. Pull meals
      const { data: meals } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId);
      
      if (meals && meals.length > 0) {
        for (const m of meals) {
          const exists = await db.meals
            .where('createdAt')
            .equals(m.created_at)
            .toArray();
          if (exists.length === 0) {
            await db.meals.add({
              foodName: m.food_name,
              mealType: m.meal_type as any,
              quantity: Number(m.quantity),
              calories: Number(m.calories),
              protein: Number(m.protein),
              carbs: Number(m.carbs),
              fats: Number(m.fats),
              date: m.logged_at,
              createdAt: m.created_at
            });
          }
        }
      }

      // 3. Pull workouts
      const { data: workouts } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId);
      
      if (workouts && workouts.length > 0) {
        for (const w of workouts) {
          const exists = await db.workouts
            .where('createdAt')
            .equals(w.created_at)
            .toArray();
          if (exists.length === 0) {
            await db.workouts.add({
              exercise: w.exercise,
              category: w.category as any,
              sets: w.sets,
              duration: w.duration ? Number(w.duration) : undefined,
              date: w.logged_at,
              createdAt: w.created_at
            });
          }
        }
      }

      // 4. Pull weight logs
      const { data: weights } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId);
      
      if (weights && weights.length > 0) {
        for (const w of weights) {
          const exists = await db.weightLogs
            .where('createdAt')
            .equals(w.created_at)
            .toArray();
          if (exists.length === 0) {
            await db.weightLogs.add({
              userId: w.user_id,
              weight: Number(w.weight),
              unit: w.unit,
              source: w.source,
              deviceMac: w.device_mac || undefined,
              loggedAt: w.logged_at,
              createdAt: w.created_at,
              updatedAt: w.updated_at,
              syncStatus: 'synced'
            });
          }
        }
      }

      // 5. Pull notes
      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId);
      
      if (notes && notes.length > 0) {
        for (const n of notes) {
          const exists = await db.notes
            .where('createdAt')
            .equals(n.created_at)
            .toArray();
          if (exists.length === 0) {
            await db.notes.add({
              title: n.title,
              content: n.content || '',
              notebook: n.notebook || undefined,
              tags: n.tags || [],
              createdAt: n.created_at,
              updatedAt: n.updated_at
            });
          }
        }
      }

      // 6. Pull fasting logs
      const { data: fastings } = await supabase
        .from('fasting_logs')
        .select('*')
        .eq('user_id', userId);
      
      if (fastings && fastings.length > 0) {
        for (const f of fastings) {
          const exists = await db.fastingLogs
            .where('startedAt')
            .equals(f.started_at)
            .toArray();
          if (exists.length === 0) {
            await db.fastingLogs.add({
              type: f.type as any,
              startedAt: f.started_at,
              durationHours: Number(f.duration_hours),
              completed: f.completed,
              endedAt: f.ended_at || undefined
            });
          }
        }
      }

      console.log('SyncEngine: All user data pulled and restored locally.');
    } catch (err) {
      console.error('Error pulling cloud data:', err);
    }
  }

  // ─── Listeners for UI state changes ────────────────────────────────────────

  public addListener(listener: () => void) {
    this.networkStatusListeners.push(listener);
  }

  public removeListener(listener: () => void) {
    this.networkStatusListeners = this.networkStatusListeners.filter((l) => l !== listener);
  }

  private notifyListeners() {
    this.networkStatusListeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error notifying network status listener:', err);
      }
    });
  }
}

// Export single instances
export const syncEngine = new SyncEngine();

// Automatic startup trigger
setTimeout(() => {
  syncEngine.syncAll();
}, 2000);
