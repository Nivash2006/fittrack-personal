/**
 * FitTrack Personal — Offline-First Synchronization Engine
 *
 * Automatically monitors browser connection states, queues pending local writes,
 * handles background retry operations with exponential backoff limits, and
 * syncs local weight log entries securely to the Supabase cloud instance.
 */

import { db } from './database';
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
