/**
 * FitTrack Personal — Exercise Database
 *
 * A curated list of ~60 common gym & bodyweight exercises categorised by
 * muscle group. Each entry includes sensible defaults for sets and reps
 * so the UI can pre-fill the workout logger.
 *
 * Usage:
 *   import { EXERCISE_DATABASE, searchExercises, getExercisesByCategory } from '@/db/exercises';
 */

// ─── Interface ───────────────────────────────────────────────────────────────

export interface Exercise {
  name: string;
  category:
    | 'chest'
    | 'back'
    | 'shoulders'
    | 'arms'
    | 'legs'
    | 'core'
    | 'cardio'
    | 'other';
  /** Recommended default number of sets */
  defaultSets: number;
  /** Recommended default number of reps per set */
  defaultReps: number;
}

// ─── Database ────────────────────────────────────────────────────────────────

export const EXERCISE_DATABASE: Exercise[] = [
  // ── Chest ────────────────────────────────────────────────────────────────
  { name: 'Flat Barbell Bench Press', category: 'chest', defaultSets: 4, defaultReps: 8 },
  { name: 'Incline Barbell Bench Press', category: 'chest', defaultSets: 4, defaultReps: 8 },
  { name: 'Decline Barbell Bench Press', category: 'chest', defaultSets: 3, defaultReps: 10 },
  { name: 'Flat Dumbbell Press', category: 'chest', defaultSets: 3, defaultReps: 10 },
  { name: 'Incline Dumbbell Press', category: 'chest', defaultSets: 3, defaultReps: 10 },
  { name: 'Dumbbell Fly', category: 'chest', defaultSets: 3, defaultReps: 12 },
  { name: 'Cable Crossover', category: 'chest', defaultSets: 3, defaultReps: 12 },
  { name: 'Push-ups', category: 'chest', defaultSets: 3, defaultReps: 15 },
  { name: 'Chest Dips', category: 'chest', defaultSets: 3, defaultReps: 10 },
  { name: 'Pec Deck Machine', category: 'chest', defaultSets: 3, defaultReps: 12 },

  // ── Back ─────────────────────────────────────────────────────────────────
  { name: 'Deadlift', category: 'back', defaultSets: 4, defaultReps: 5 },
  { name: 'Barbell Row', category: 'back', defaultSets: 4, defaultReps: 8 },
  { name: 'Pull-ups', category: 'back', defaultSets: 3, defaultReps: 8 },
  { name: 'Chin-ups', category: 'back', defaultSets: 3, defaultReps: 8 },
  { name: 'Lat Pulldown', category: 'back', defaultSets: 3, defaultReps: 10 },
  { name: 'Seated Cable Row', category: 'back', defaultSets: 3, defaultReps: 10 },
  { name: 'T-Bar Row', category: 'back', defaultSets: 3, defaultReps: 8 },
  { name: 'Single-Arm Dumbbell Row', category: 'back', defaultSets: 3, defaultReps: 10 },
  { name: 'Face Pull', category: 'back', defaultSets: 3, defaultReps: 15 },

  // ── Shoulders ────────────────────────────────────────────────────────────
  { name: 'Overhead Press (Barbell)', category: 'shoulders', defaultSets: 4, defaultReps: 8 },
  { name: 'Dumbbell Shoulder Press', category: 'shoulders', defaultSets: 3, defaultReps: 10 },
  { name: 'Arnold Press', category: 'shoulders', defaultSets: 3, defaultReps: 10 },
  { name: 'Lateral Raise', category: 'shoulders', defaultSets: 3, defaultReps: 15 },
  { name: 'Front Raise', category: 'shoulders', defaultSets: 3, defaultReps: 12 },
  { name: 'Rear Delt Fly', category: 'shoulders', defaultSets: 3, defaultReps: 15 },
  { name: 'Upright Row', category: 'shoulders', defaultSets: 3, defaultReps: 10 },
  { name: 'Shrugs', category: 'shoulders', defaultSets: 3, defaultReps: 12 },

  // ── Arms ─────────────────────────────────────────────────────────────────
  { name: 'Barbell Bicep Curl', category: 'arms', defaultSets: 3, defaultReps: 10 },
  { name: 'Dumbbell Bicep Curl', category: 'arms', defaultSets: 3, defaultReps: 10 },
  { name: 'Hammer Curl', category: 'arms', defaultSets: 3, defaultReps: 10 },
  { name: 'Preacher Curl', category: 'arms', defaultSets: 3, defaultReps: 10 },
  { name: 'Concentration Curl', category: 'arms', defaultSets: 3, defaultReps: 12 },
  { name: 'Tricep Pushdown', category: 'arms', defaultSets: 3, defaultReps: 12 },
  { name: 'Overhead Tricep Extension', category: 'arms', defaultSets: 3, defaultReps: 10 },
  { name: 'Skull Crushers', category: 'arms', defaultSets: 3, defaultReps: 10 },
  { name: 'Close-Grip Bench Press', category: 'arms', defaultSets: 3, defaultReps: 10 },
  { name: 'Tricep Dips', category: 'arms', defaultSets: 3, defaultReps: 10 },
  { name: 'Wrist Curl', category: 'arms', defaultSets: 3, defaultReps: 15 },

  // ── Legs ─────────────────────────────────────────────────────────────────
  { name: 'Barbell Squat', category: 'legs', defaultSets: 4, defaultReps: 8 },
  { name: 'Front Squat', category: 'legs', defaultSets: 4, defaultReps: 8 },
  { name: 'Leg Press', category: 'legs', defaultSets: 4, defaultReps: 10 },
  { name: 'Lunges', category: 'legs', defaultSets: 3, defaultReps: 12 },
  { name: 'Bulgarian Split Squat', category: 'legs', defaultSets: 3, defaultReps: 10 },
  { name: 'Leg Extension', category: 'legs', defaultSets: 3, defaultReps: 12 },
  { name: 'Leg Curl', category: 'legs', defaultSets: 3, defaultReps: 12 },
  { name: 'Romanian Deadlift', category: 'legs', defaultSets: 3, defaultReps: 10 },
  { name: 'Hip Thrust', category: 'legs', defaultSets: 3, defaultReps: 10 },
  { name: 'Calf Raise (Standing)', category: 'legs', defaultSets: 4, defaultReps: 15 },
  { name: 'Calf Raise (Seated)', category: 'legs', defaultSets: 3, defaultReps: 15 },
  { name: 'Goblet Squat', category: 'legs', defaultSets: 3, defaultReps: 12 },

  // ── Core ─────────────────────────────────────────────────────────────────
  { name: 'Plank', category: 'core', defaultSets: 3, defaultReps: 60 },        // reps = seconds
  { name: 'Crunches', category: 'core', defaultSets: 3, defaultReps: 20 },
  { name: 'Bicycle Crunches', category: 'core', defaultSets: 3, defaultReps: 20 },
  { name: 'Russian Twist', category: 'core', defaultSets: 3, defaultReps: 20 },
  { name: 'Leg Raise (Hanging)', category: 'core', defaultSets: 3, defaultReps: 12 },
  { name: 'Leg Raise (Lying)', category: 'core', defaultSets: 3, defaultReps: 15 },
  { name: 'Ab Wheel Rollout', category: 'core', defaultSets: 3, defaultReps: 10 },
  { name: 'Mountain Climbers', category: 'core', defaultSets: 3, defaultReps: 20 },

  // ── Cardio ───────────────────────────────────────────────────────────────
  { name: 'Treadmill Running', category: 'cardio', defaultSets: 1, defaultReps: 30 },   // reps = minutes
  { name: 'Treadmill Walking', category: 'cardio', defaultSets: 1, defaultReps: 30 },
  { name: 'Stationary Cycling', category: 'cardio', defaultSets: 1, defaultReps: 30 },
  { name: 'Elliptical Trainer', category: 'cardio', defaultSets: 1, defaultReps: 30 },
  { name: 'Stair Climber', category: 'cardio', defaultSets: 1, defaultReps: 20 },
  { name: 'Jump Rope', category: 'cardio', defaultSets: 3, defaultReps: 100 },          // reps = jumps
  { name: 'Rowing Machine', category: 'cardio', defaultSets: 1, defaultReps: 20 },
  { name: 'Swimming', category: 'cardio', defaultSets: 1, defaultReps: 30 },
  { name: 'Burpees', category: 'cardio', defaultSets: 3, defaultReps: 15 },
  
  // ── Sports & Games ─────────────────────────────────────────────────────────
  { name: 'Cricket', category: 'cardio', defaultSets: 1, defaultReps: 60 },
  { name: 'Badminton', category: 'cardio', defaultSets: 1, defaultReps: 45 },
  { name: 'Football (Soccer)', category: 'cardio', defaultSets: 1, defaultReps: 90 },
  { name: 'Basketball', category: 'cardio', defaultSets: 1, defaultReps: 45 },
  { name: 'Table Tennis', category: 'cardio', defaultSets: 1, defaultReps: 30 },
  { name: 'Tennis', category: 'cardio', defaultSets: 1, defaultReps: 60 },
  { name: 'Volleyball', category: 'cardio', defaultSets: 1, defaultReps: 45 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return exercises whose name matches the query (case-insensitive substring).
 * Falls back to an empty array if nothing matches.
 */
export function searchExercises(query: string): Exercise[] {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  return EXERCISE_DATABASE.filter((e) => e.name.toLowerCase().includes(lower));
}

/**
 * Return all exercises in a given body-part / category.
 */
export function getExercisesByCategory(
  category: Exercise['category'],
): Exercise[] {
  return EXERCISE_DATABASE.filter((e) => e.category === category);
}

/**
 * All unique category labels, useful for building tab / filter UIs.
 */
export const EXERCISE_CATEGORIES: Exercise['category'][] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'core',
  'cardio',
  'other',
];
