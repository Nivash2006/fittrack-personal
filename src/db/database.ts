/**
 * FitTrack Personal — Dexie Database Schema
 *
 * Central IndexedDB database powering all offline-first storage for the app.
 * Uses Dexie v4 with typed tables. Each table is indexed on the fields most
 * commonly used for querying (date ranges, meal types, exercise categories, etc.).
 */

import Dexie, { type Table } from 'dexie';

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** User profile & macro targets */
export interface UserProfile {
  id?: number;
  name: string;
  email: string;
  heightCm: number;
  weightKg: number;
  age: number;
  gender: 'male' | 'female';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal: 'lose' | 'maintain' | 'gain';
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  /** Daily water intake target in millilitres */
  waterTarget: number;
  createdAt: string;
}

/** A single food-intake entry */
export interface Meal {
  id?: number;
  foodName: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  /** Quantity in grams */
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  /** ISO date string YYYY-MM-DD */
  date: string;
  createdAt: string;
}

/** A single workout session */
export interface Workout {
  id?: number;
  exercise: string;
  category:
    | 'chest'
    | 'back'
    | 'shoulders'
    | 'arms'
    | 'legs'
    | 'core'
    | 'cardio'
    | 'other';
  sets: Array<{ reps: number; weight: number }>;
  /** Duration in minutes — mainly for cardio */
  duration?: number;
  /** ISO date string YYYY-MM-DD */
  date: string;
  createdAt: string;
}

/** Body-weight entry for progress tracking */
export interface WeightLog {
  id?: number;
  userId?: string;
  weight: number;
  unit: string;
  source: string; // 'manual' or 'antalpha_scale'
  loggedAt: string; // ISO date string YYYY-MM-DD
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  deviceMac?: string;
}

/** A repeatable habit the user wants to track */
export interface Habit {
  id?: number;
  title: string;
  /** Emoji or icon identifier */
  icon: string;
  /** Array of YYYY-MM-DD dates on which the habit was completed */
  completedDates: string[];
  createdAt: string;
}

/** Water intake log entry */
export interface WaterLog {
  id?: number;
  /** Amount in millilitres */
  amount: number;
  /** ISO date string YYYY-MM-DD */
  date: string;
  createdAt: string;
}

/** Sleep log entry */
export interface SleepLog {
  id?: number;
  /** Hours of sleep */
  hours: number;
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  /** ISO date string YYYY-MM-DD */
  date: string;
}

/** Step counter log entry */
export interface StepLog {
  id?: number;
  /** Step count */
  count: number;
  /** ISO date string YYYY-MM-DD */
  date: string;
}

/** Connected smart scales tracking */
export interface ConnectedDevice {
  id?: number;
  userId?: string;
  deviceMac: string;
  deviceName: string;
  lastConnectedAt: string;
  lastBatteryLevel?: number;
  firmwareVersion?: string;
  isPrimary: boolean;
}

/** Offline synchronization queue */
export interface SyncQueue {
  id?: number;
  entityType: 'weightLogs' | 'connectedDevices';
  entityId: number; // References the local primary key (id) of the entity
  operation: 'create' | 'update' | 'delete';
  createdAt: string;
  retryCount: number;
}

/** Progress photos tracking */
export interface ProgressPhoto {
  id?: number;
  userId?: string;
  loggedAt: string; // ISO date string YYYY-MM-DD
  category: 'front' | 'side' | 'back' | 'other';
  weightKg?: number;
  caption?: string;
  photoBlob: Blob; // Compressed Full JPG image
  thumbnailBlob: Blob; // Ultra-compressed small JPG image
  createdAt: string; // ISO timestamp
}

export interface NoteLog {
  id?: number;
  title: string;
  content: string;
  tags: string[];
  notebook?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FastingLog {
  id?: number;
  type: '16:8' | '18:6' | '20:4' | '24:0' | 'custom';
  startedAt: string;
  durationHours: number;
  completed: boolean;
  endedAt?: string;
}

// ─── Database Class ──────────────────────────────────────────────────────────

export class FitTrackDB extends Dexie {
  userProfiles!: Table<UserProfile, number>;
  meals!: Table<Meal, number>;
  workouts!: Table<Workout, number>;
  weightLogs!: Table<WeightLog, number>;
  habits!: Table<Habit, number>;
  waterLogs!: Table<WaterLog, number>;
  sleepLogs!: Table<SleepLog, number>;
  stepLogs!: Table<StepLog, number>;
  connectedDevices!: Table<ConnectedDevice, number>;
  syncQueue!: Table<SyncQueue, number>;
  progressPhotos!: Table<ProgressPhoto, number>;
  notes!: Table<NoteLog, number>;
  fastingLogs!: Table<FastingLog, number>;

  constructor() {
    super('FitTrackDB');

    // Version 1 Schema (Original)
    this.version(1).stores({
      userProfiles: '++id, email',
      meals: '++id, date, mealType, [date+mealType]',
      workouts: '++id, date, category, [date+category]',
      weightLogs: '++id, loggedAt',
      habits: '++id, title',
      waterLogs: '++id, date',
      sleepLogs: '++id, date',
      stepLogs: '++id, date',
    });

    // Version 2 Schema (Scale & Sync)
    this.version(2).stores({
      userProfiles: '++id, email',
      meals: '++id, date, mealType, [date+mealType]',
      workouts: '++id, date, category, [date+category]',
      weightLogs: '++id, userId, weight, unit, source, loggedAt, syncStatus, [loggedAt+weight]',
      habits: '++id, title',
      waterLogs: '++id, date',
      sleepLogs: '++id, date',
      stepLogs: '++id, date',
      connectedDevices: '++id, userId, deviceMac, deviceName, lastConnectedAt',
      syncQueue: '++id, entityType, entityId, operation, createdAt',
    });

    // Version 3 Schema (Adds Progress Photos Gallery)
    this.version(3).stores({
      userProfiles: '++id, email',
      meals: '++id, date, mealType, [date+mealType]',
      workouts: '++id, date, category, [date+category]',
      weightLogs: '++id, userId, weight, unit, source, loggedAt, syncStatus, [loggedAt+weight]',
      habits: '++id, title',
      waterLogs: '++id, date',
      sleepLogs: '++id, date',
      stepLogs: '++id, date',
      connectedDevices: '++id, userId, deviceMac, deviceName, lastConnectedAt',
      syncQueue: '++id, entityType, entityId, operation, createdAt',
      progressPhotos: '++id, userId, loggedAt, category',
    });

    // Version 4 Schema (Adds Note-Taking & Fasting Logs)
    this.version(4).stores({
      userProfiles: '++id, email',
      meals: '++id, date, mealType, [date+mealType]',
      workouts: '++id, date, category, [date+category]',
      weightLogs: '++id, userId, weight, unit, source, loggedAt, syncStatus, [loggedAt+weight]',
      habits: '++id, title',
      waterLogs: '++id, date',
      sleepLogs: '++id, date',
      stepLogs: '++id, date',
      connectedDevices: '++id, userId, deviceMac, deviceName, lastConnectedAt',
      syncQueue: '++id, entityType, entityId, operation, createdAt',
      progressPhotos: '++id, userId, loggedAt, category',
      notes: '++id, title, notebook, *tags, createdAt, updatedAt',
      fastingLogs: '++id, type, startedAt, completed',
    });
  }
}

// ─── Singleton Instance ──────────────────────────────────────────────────────

export const db = new FitTrackDB();
