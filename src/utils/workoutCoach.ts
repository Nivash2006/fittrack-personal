/**
 * FitTrack Personal — Workout Coach Engine
 *
 * Provides:
 * - Personal Record detection per exercise
 * - Progressive overload suggestions (suggestion-only, user must accept)
 * - Fatigue safety rules (checks sleep, calorie deficit)
 * - Workout template library
 * - 1RM estimation (Epley formula)
 *
 * All logic is local/offline. No external APIs.
 */

import type { Workout, PersonalRecord, SleepLog, Meal, UserProfile } from '../db/database';
import { calculateBMR, calculateTDEE } from './helpers';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface OverloadSuggestion {
  exerciseName: string;
  currentWeight: number;
  currentReps: number;
  suggestedWeight: number;
  suggestedReps: number;
  strategy: 'increase_weight' | 'increase_reps' | 'deload' | 'maintain';
  reason: string;
  isSafe: boolean;
  fatigueWarning?: string;
}

export interface ExerciseSession {
  date: string;
  maxWeight: number;
  maxReps: number;
  totalVolume: number;   // sum of weight*reps across all sets
  estimated1RM: number;
}

export interface WorkoutTemplatePreset {
  name: string;
  description: string;
  category: string;
  daysPerWeek: number;
  exercises: Array<{
    exerciseName: string;
    defaultSets: number;
    defaultReps: number;
    restSeconds: number;
    notes?: string;
  }>;
}

// ─── 1RM Estimation ───────────────────────────────────────────────────────────

/**
 * Epley 1RM formula: weight × (1 + reps / 30)
 * Returns 0 for bodyweight sets (weight === 0) or single-rep sets.
 */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// ─── Session History ──────────────────────────────────────────────────────────

/**
 * Find all sessions for a specific exercise from workout history.
 * Sorted newest first.
 */
export function getExerciseSessions(
  exerciseName: string,
  allWorkouts: Workout[]
): ExerciseSession[] {
  const lowerTarget = exerciseName.toLowerCase();

  const sessions = allWorkouts
    .filter((w) => w.exercise.toLowerCase() === lowerTarget)
    .map((w) => {
      const weightedSets = w.sets.filter((s) => s.weight > 0 && s.reps > 0);

      const maxWeight = weightedSets.length > 0
        ? Math.max(...weightedSets.map((s) => s.weight))
        : 0;

      // Max reps at the maximum weight
      const setsAtMaxWeight = weightedSets.filter((s) => s.weight === maxWeight);
      const maxReps = setsAtMaxWeight.length > 0
        ? Math.max(...setsAtMaxWeight.map((s) => s.reps))
        : (w.sets.length > 0 ? Math.max(...w.sets.map((s) => s.reps)) : 0);

      const totalVolume = w.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

      // Best 1RM estimate across all sets in the session
      const best1RM = Math.max(
        0,
        ...w.sets.map((s) => estimate1RM(s.weight, s.reps))
      );

      return {
        date: w.date,
        maxWeight,
        maxReps,
        totalVolume,
        estimated1RM: best1RM,
      } satisfies ExerciseSession;
    });

  // Newest first
  return sessions.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Personal Records ─────────────────────────────────────────────────────────

/**
 * Get the personal record for an exercise.
 * PR = highest estimated 1RM across all sessions.
 */
export function getPersonalRecord(
  exerciseName: string,
  allWorkouts: Workout[]
): PersonalRecord | null {
  const sessions = getExerciseSessions(exerciseName, allWorkouts);
  if (sessions.length === 0) return null;

  const best = sessions.reduce<ExerciseSession | null>((prev, cur) => {
    if (!prev) return cur;
    return cur.estimated1RM > prev.estimated1RM ? cur : prev;
  }, null);

  if (!best || best.estimated1RM === 0) return null;

  return {
    exercise: exerciseName,
    maxWeight: best.maxWeight,
    maxReps: best.maxReps,
    estimated1RM: best.estimated1RM,
    date: best.date,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Check if the latest session for an exercise is a new PR.
 * Compares the best 1RM from the provided sets against all prior sessions.
 */
export function isNewPersonalRecord(
  exerciseName: string,
  newSets: Array<{ weight: number; reps: number }>,
  allWorkouts: Workout[]
): boolean {
  const new1RM = Math.max(
    0,
    ...newSets.map((s) => estimate1RM(s.weight, s.reps))
  );

  if (new1RM === 0) return false;

  const existingPR = getPersonalRecord(exerciseName, allWorkouts);
  if (!existingPR) return true;                     // first ever session

  return new1RM > existingPR.estimated1RM;
}

// ─── Fatigue Assessment ───────────────────────────────────────────────────────

/**
 * Evaluate fatigue from sleep quality/duration and calorie deficit.
 * Returns a safety level and optional warning message.
 *
 * Rules:
 *  HIGH fatigue  → sleep < 6 h  OR  calorie deficit > 700 kcal
 *  MEDIUM fatigue → sleep 6–7 h  OR  calorie deficit 400–700 kcal
 *  LOW fatigue   → sleep ≥ 7 h  AND  deficit ≤ 400 kcal
 */
export function assessFatigue(
  recentSleep: SleepLog | undefined,
  todayMeals: Meal[],
  profile: UserProfile
): { level: 'low' | 'medium' | 'high'; warning?: string } {
  const warnings: string[] = [];
  let fatiguePoints = 0;

  // ── Sleep check ────────────────────────────────────────────────────────────
  const sleepHours = recentSleep?.hours ?? 7;   // assume adequate if no log
  const sleepQuality = recentSleep?.quality;

  if (sleepHours < 6) {
    fatiguePoints += 2;
    warnings.push(`Only ${sleepHours}h of sleep logged — risk of injury is elevated`);
  } else if (sleepHours < 7) {
    fatiguePoints += 1;
    warnings.push(`${sleepHours}h of sleep — consider a lighter session`);
  }

  if (sleepQuality === 'poor') {
    fatiguePoints += 1;
    warnings.push('Poor sleep quality reported');
  }

  // ── Calorie deficit check ──────────────────────────────────────────────────
  const consumedCalories = todayMeals.reduce((sum, m) => sum + m.calories, 0);
  const bmr = calculateBMR(profile.gender, profile.weightKg, profile.heightCm, profile.age);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const deficit = tdee - consumedCalories;

  if (deficit > 700) {
    fatiguePoints += 2;
    warnings.push(`Large calorie deficit of ~${Math.round(deficit)} kcal — fuel your workout`);
  } else if (deficit > 400) {
    fatiguePoints += 1;
    warnings.push(`Moderate deficit of ~${Math.round(deficit)} kcal — consider a pre-workout snack`);
  }

  // ── Aggregate ──────────────────────────────────────────────────────────────
  let level: 'low' | 'medium' | 'high';
  if (fatiguePoints >= 3) {
    level = 'high';
  } else if (fatiguePoints >= 1) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return {
    level,
    warning: warnings.length > 0 ? warnings.join(' · ') : undefined,
  };
}

// ─── Progressive Overload ─────────────────────────────────────────────────────

/** Round a weight to the nearest 2.5 kg increment */
function roundTo2p5(weight: number): number {
  return Math.round(weight / 2.5) * 2.5;
}

/**
 * Generate a progressive overload suggestion for an exercise.
 * Never auto-applies — user must manually accept.
 *
 * Logic matrix:
 *  High fatigue            → deload  (80% of current weight, same reps)
 *  0 sessions              → null    (no data)
 *  1 session               → maintain (baseline established)
 *  2–3 sessions            → +5% weight (rounded to 2.5 kg)
 *  4 sessions, same weight → +5% weight
 *  5+ sessions same weight → +1 rep instead of weight increase
 */
export function getOverloadSuggestion(
  exerciseName: string,
  allWorkouts: Workout[],
  fatigueLevel: 'low' | 'medium' | 'high'
): OverloadSuggestion | null {
  const sessions = getExerciseSessions(exerciseName, allWorkouts);
  if (sessions.length === 0) return null;

  const latest = sessions[0];
  const { maxWeight: currentWeight, maxReps: currentReps } = latest;

  // ── Deload on high fatigue ─────────────────────────────────────────────────
  if (fatigueLevel === 'high') {
    const deloadWeight = roundTo2p5(currentWeight * 0.8);
    return {
      exerciseName,
      currentWeight,
      currentReps,
      suggestedWeight: deloadWeight > 0 ? deloadWeight : currentWeight,
      suggestedReps: currentReps,
      strategy: 'deload',
      reason: 'High fatigue detected. Deloading to 80% to protect recovery.',
      isSafe: true,
      fatigueWarning: 'Prioritise sleep and nutrition before pushing heavier.',
    };
  }

  // ── Baseline (1 session) ───────────────────────────────────────────────────
  if (sessions.length === 1) {
    return {
      exerciseName,
      currentWeight,
      currentReps,
      suggestedWeight: currentWeight,
      suggestedReps: currentReps,
      strategy: 'maintain',
      reason: 'First session logged. Maintain current weight to establish a baseline.',
      isSafe: true,
    };
  }

  // ── 2–3 sessions: +5% weight ──────────────────────────────────────────────
  if (sessions.length <= 3) {
    const suggestedWeight = roundTo2p5(currentWeight * 1.05);
    const fatigueWarning = fatigueLevel === 'medium'
      ? 'Moderate fatigue — only increase if you feel ready.'
      : undefined;
    return {
      exerciseName,
      currentWeight,
      currentReps,
      suggestedWeight,
      suggestedReps: currentReps,
      strategy: 'increase_weight',
      reason: `${sessions.length} sessions logged. Time to add ~5% more weight.`,
      isSafe: true,
      fatigueWarning,
    };
  }

  // ── 4+ sessions: check if weight has stalled ──────────────────────────────
  const recentFive = sessions.slice(0, 5);
  const firstWeight = recentFive[recentFive.length - 1].maxWeight;
  const allSameWeight = recentFive.every((s) => s.maxWeight === firstWeight);

  // 5+ sessions at the same weight → +1 rep
  if (sessions.length >= 5 && allSameWeight) {
    return {
      exerciseName,
      currentWeight,
      currentReps,
      suggestedWeight: currentWeight,
      suggestedReps: currentReps + 1,
      strategy: 'increase_reps',
      reason: `Same weight for ${recentFive.length}+ sessions. Add 1 rep to build strength before increasing load.`,
      isSafe: true,
      fatigueWarning: fatigueLevel === 'medium'
        ? 'Moderate fatigue — ensure form stays tight.'
        : undefined,
    };
  }

  // 4 sessions or mixed weights → +5% weight
  const suggestedWeight = roundTo2p5(currentWeight * 1.05);
  return {
    exerciseName,
    currentWeight,
    currentReps,
    suggestedWeight,
    suggestedReps: currentReps,
    strategy: 'increase_weight',
    reason: 'Consistent progress detected. Ready to increase weight by ~5%.',
    isSafe: true,
    fatigueWarning: fatigueLevel === 'medium'
      ? 'Moderate fatigue — only increase if feeling strong today.'
      : undefined,
  };
}

// ─── Workout Template Presets ─────────────────────────────────────────────────

/**
 * Built-in workout template presets.
 * Exercise names match entries in EXERCISE_DATABASE.
 */
export const WORKOUT_TEMPLATES: WorkoutTemplatePreset[] = [
  // ── 1. Push Day ─────────────────────────────────────────────────────────
  {
    name: 'Push Day',
    description: 'Chest, shoulders, and triceps — classic PPL push session.',
    category: 'push',
    daysPerWeek: 2,
    exercises: [
      {
        exerciseName: 'Flat Barbell Bench Press',
        defaultSets: 4,
        defaultReps: 8,
        restSeconds: 120,
        notes: 'Drive feet into the floor; keep scapulae retracted.',
      },
      {
        exerciseName: 'Incline Dumbbell Press',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 90,
        notes: '30-45° incline; control the eccentric.',
      },
      {
        exerciseName: 'Dumbbell Fly',
        defaultSets: 3,
        defaultReps: 12,
        restSeconds: 60,
        notes: 'Slight bend in elbow; stretch at the bottom.',
      },
      {
        exerciseName: 'Overhead Press (Barbell)',
        defaultSets: 4,
        defaultReps: 8,
        restSeconds: 120,
        notes: 'Brace core; do not hyperextend lower back.',
      },
      {
        exerciseName: 'Lateral Raise',
        defaultSets: 3,
        defaultReps: 15,
        restSeconds: 60,
        notes: 'Lead with elbows; thumbs slightly down.',
      },
      {
        exerciseName: 'Tricep Pushdown',
        defaultSets: 3,
        defaultReps: 12,
        restSeconds: 60,
        notes: 'Keep elbows pinned to sides throughout.',
      },
      {
        exerciseName: 'Overhead Tricep Extension',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 60,
        notes: 'Full stretch at the bottom; squeeze at top.',
      },
    ],
  },

  // ── 2. Pull Day ─────────────────────────────────────────────────────────
  {
    name: 'Pull Day',
    description: 'Back and biceps — the essential pull complement to Push Day.',
    category: 'pull',
    daysPerWeek: 2,
    exercises: [
      {
        exerciseName: 'Deadlift',
        defaultSets: 4,
        defaultReps: 5,
        restSeconds: 180,
        notes: 'Hip hinge; neutral spine; push the floor away.',
      },
      {
        exerciseName: 'Pull-ups',
        defaultSets: 3,
        defaultReps: 8,
        restSeconds: 90,
        notes: 'Dead hang to full lockout; no kipping.',
      },
      {
        exerciseName: 'Barbell Row',
        defaultSets: 4,
        defaultReps: 8,
        restSeconds: 90,
        notes: 'Overhand grip; pull bar to lower chest.',
      },
      {
        exerciseName: 'Lat Pulldown',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 75,
        notes: 'Lean back slightly; drive elbows to hips.',
      },
      {
        exerciseName: 'Face Pull',
        defaultSets: 3,
        defaultReps: 15,
        restSeconds: 60,
        notes: 'Pull to forehead; external rotate at end range.',
      },
      {
        exerciseName: 'Barbell Bicep Curl',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 60,
        notes: 'Elbows stationary; no swinging.',
      },
      {
        exerciseName: 'Hammer Curl',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 60,
        notes: 'Neutral grip targets brachialis.',
      },
    ],
  },

  // ── 3. Leg Day ──────────────────────────────────────────────────────────
  {
    name: 'Leg Day',
    description: 'Quads, hamstrings, and glutes — full lower body hypertrophy.',
    category: 'legs',
    daysPerWeek: 2,
    exercises: [
      {
        exerciseName: 'Barbell Squat',
        defaultSets: 4,
        defaultReps: 8,
        restSeconds: 180,
        notes: 'Break parallel; knees track over toes.',
      },
      {
        exerciseName: 'Romanian Deadlift',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 90,
        notes: 'Hinge until hamstrings fully loaded; maintain neutral spine.',
      },
      {
        exerciseName: 'Leg Press',
        defaultSets: 4,
        defaultReps: 10,
        restSeconds: 90,
        notes: 'Feet shoulder-width; do not lock out knees.',
      },
      {
        exerciseName: 'Bulgarian Split Squat',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 90,
        notes: 'Keep torso upright; rear foot elevated.',
      },
      {
        exerciseName: 'Leg Curl',
        defaultSets: 3,
        defaultReps: 12,
        restSeconds: 60,
        notes: 'Full range of motion; squeeze at peak contraction.',
      },
      {
        exerciseName: 'Hip Thrust',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 75,
        notes: 'Drive through heels; full glute lockout at top.',
      },
      {
        exerciseName: 'Calf Raise (Standing)',
        defaultSets: 4,
        defaultReps: 15,
        restSeconds: 45,
        notes: 'Pause at top; full stretch at bottom.',
      },
    ],
  },

  // ── 4. Full Body (Beginner 3×/week) ────────────────────────────────────
  {
    name: 'Full Body — Beginner',
    description: 'Balanced full-body routine for beginners training 3 days per week.',
    category: 'full',
    daysPerWeek: 3,
    exercises: [
      {
        exerciseName: 'Barbell Squat',
        defaultSets: 3,
        defaultReps: 8,
        restSeconds: 120,
        notes: 'Focus on depth and form before adding weight.',
      },
      {
        exerciseName: 'Flat Barbell Bench Press',
        defaultSets: 3,
        defaultReps: 8,
        restSeconds: 120,
        notes: 'Spotter recommended for beginners.',
      },
      {
        exerciseName: 'Barbell Row',
        defaultSets: 3,
        defaultReps: 8,
        restSeconds: 90,
        notes: 'Great antagonist pair with bench press.',
      },
      {
        exerciseName: 'Overhead Press (Barbell)',
        defaultSets: 3,
        defaultReps: 8,
        restSeconds: 90,
        notes: 'Use lighter weight than bench; strict form.',
      },
      {
        exerciseName: 'Deadlift',
        defaultSets: 1,
        defaultReps: 5,
        restSeconds: 180,
        notes: 'Single heavy set — quality over quantity.',
      },
      {
        exerciseName: 'Plank',
        defaultSets: 3,
        defaultReps: 30,
        restSeconds: 45,
        notes: '30 seconds per set; progress to 60s over time.',
      },
    ],
  },

  // ── 5. Upper Body ───────────────────────────────────────────────────────
  {
    name: 'Upper Body',
    description: 'Comprehensive upper-body session for strength and hypertrophy.',
    category: 'upper',
    daysPerWeek: 2,
    exercises: [
      {
        exerciseName: 'Flat Barbell Bench Press',
        defaultSets: 4,
        defaultReps: 8,
        restSeconds: 120,
      },
      {
        exerciseName: 'Pull-ups',
        defaultSets: 3,
        defaultReps: 8,
        restSeconds: 90,
        notes: 'Add weight once you hit 3×10 bodyweight.',
      },
      {
        exerciseName: 'Overhead Press (Barbell)',
        defaultSets: 3,
        defaultReps: 8,
        restSeconds: 90,
      },
      {
        exerciseName: 'Seated Cable Row',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 75,
      },
      {
        exerciseName: 'Incline Dumbbell Press',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 75,
      },
      {
        exerciseName: 'Lateral Raise',
        defaultSets: 3,
        defaultReps: 15,
        restSeconds: 45,
      },
      {
        exerciseName: 'Barbell Bicep Curl',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 60,
      },
      {
        exerciseName: 'Skull Crushers',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 60,
      },
    ],
  },

  // ── 6. Cardio + Core ────────────────────────────────────────────────────
  {
    name: 'Cardio + Core',
    description: 'Cardiovascular conditioning paired with core stability work.',
    category: 'cardio',
    daysPerWeek: 2,
    exercises: [
      {
        exerciseName: 'Treadmill Running',
        defaultSets: 1,
        defaultReps: 20,
        restSeconds: 0,
        notes: 'Moderate pace (Zone 2); 20 min steady state.',
      },
      {
        exerciseName: 'Burpees',
        defaultSets: 3,
        defaultReps: 15,
        restSeconds: 60,
        notes: 'Full extension at top; chest to floor at bottom.',
      },
      {
        exerciseName: 'Jump Rope',
        defaultSets: 3,
        defaultReps: 100,
        restSeconds: 60,
        notes: 'Double-unders optional; focus on rhythm.',
      },
      {
        exerciseName: 'Plank',
        defaultSets: 3,
        defaultReps: 60,
        restSeconds: 45,
        notes: '60 seconds; squeeze glutes and abs throughout.',
      },
      {
        exerciseName: 'Bicycle Crunches',
        defaultSets: 3,
        defaultReps: 20,
        restSeconds: 45,
        notes: '20 reps per side; controlled rotation.',
      },
      {
        exerciseName: 'Leg Raise (Hanging)',
        defaultSets: 3,
        defaultReps: 12,
        restSeconds: 45,
        notes: 'Posterior pelvic tilt at the top.',
      },
      {
        exerciseName: 'Mountain Climbers',
        defaultSets: 3,
        defaultReps: 20,
        restSeconds: 30,
        notes: '20 reps each leg; keep hips level.',
      },
      {
        exerciseName: 'Ab Wheel Rollout',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 60,
        notes: 'From knees; brace abs hard to protect lower back.',
      },
    ],
  },

  // ── 7. Shoulders & Arms ─────────────────────────────────────────────────
  {
    name: 'Shoulders & Arms',
    description: 'Dedicated isolation day for deltoids, biceps, and triceps.',
    category: 'push',
    daysPerWeek: 1,
    exercises: [
      {
        exerciseName: 'Overhead Press (Barbell)',
        defaultSets: 4,
        defaultReps: 8,
        restSeconds: 120,
        notes: 'Compound starter — go heavy.',
      },
      {
        exerciseName: 'Arnold Press',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 75,
        notes: 'Full rotation; great for all three deltoid heads.',
      },
      {
        exerciseName: 'Lateral Raise',
        defaultSets: 4,
        defaultReps: 15,
        restSeconds: 45,
      },
      {
        exerciseName: 'Rear Delt Fly',
        defaultSets: 3,
        defaultReps: 15,
        restSeconds: 45,
        notes: 'Bent-over or seated on incline bench.',
      },
      {
        exerciseName: 'Barbell Bicep Curl',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 60,
      },
      {
        exerciseName: 'Hammer Curl',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 60,
      },
      {
        exerciseName: 'Preacher Curl',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 60,
        notes: 'Great for peak bicep contraction.',
      },
      {
        exerciseName: 'Tricep Pushdown',
        defaultSets: 3,
        defaultReps: 12,
        restSeconds: 60,
      },
      {
        exerciseName: 'Overhead Tricep Extension',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 60,
      },
      {
        exerciseName: 'Skull Crushers',
        defaultSets: 3,
        defaultReps: 10,
        restSeconds: 60,
        notes: 'Superset with close-grip bench for a pump finisher.',
      },
    ],
  },
];
