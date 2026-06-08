/**
 * FitTrack Personal — Health Intelligence Score Engine
 *
 * Calculates a composite 0-100 health score from:
 * - Nutrition Consistency  (30%) — hitting calorie targets regularly
 * - Exercise Frequency     (25%) — workouts per week
 * - Sleep Quality          (25%) — hours and quality over last 7 days
 * - Hydration              (20%) — water intake vs target
 *
 * IMPORTANT: Use RANGES not fake precision.
 * Example: bodyFat shown as '18–21%' not '18.432%'
 *
 * All data comes from local Dexie DB. No external APIs.
 */

import type { UserProfile, Meal, Workout, SleepLog, WaterLog } from '../db/database';
import { getLast7Days, calculateBMI, getBMICategory } from './helpers';

export type ScoreBand = 'poor' | 'fair' | 'good' | 'excellent';

export interface SubScore {
  label: string;
  score: number;      // 0-100
  band: ScoreBand;
  weight: number;     // contribution weight (0-1)
  detail: string;     // human-readable explanation
  icon: string;
}

export interface HealthScoreResult {
  overall: number;            // 0-100 composite
  band: ScoreBand;
  subScores: SubScore[];
  insights: string[];         // 2-3 actionable insight strings
  bodyFatRange?: string;      // e.g. '18–21%' (estimated range, not precise)
  ffmiEstimate?: number;      // Fat-Free Mass Index estimate
  bmi: number;
  bmiCategory: string;
}

// ─── Band Utilities ───────────────────────────────────────────────────────────

/**
 * Score color for band (CSS color values matching app theme).
 */
export function getBandColor(band: ScoreBand): string {
  switch (band) {
    case 'excellent': return 'var(--accent)';
    case 'good':      return 'var(--accent2)';
    case 'fair':      return '#ffb347';
    case 'poor':      return 'var(--danger)';
  }
}

export function getBand(score: number): ScoreBand {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

// ─── Body Composition Estimation ──────────────────────────────────────────────

/**
 * Estimate body fat % range using BMI-based Deurenberg formula (gender-adjusted).
 * - Male:   approx = 1.20 × BMI + 0.23 × age − 16.2
 * - Female: approx = 1.20 × BMI + 0.23 × age − 5.4
 *
 * Returns a ±3% range string like '17–22%'.
 * NEVER returns a precise decimal — always a range.
 */
export function estimateBodyFatRange(profile: UserProfile): string {
  const bmi = calculateBMI(profile.weightKg, profile.heightCm);
  let approx: number;

  if (profile.gender === 'male') {
    approx = 1.20 * bmi + 0.23 * profile.age - 16.2;
  } else {
    approx = 1.20 * bmi + 0.23 * profile.age - 5.4;
  }

  // Clamp to physiologically plausible range
  approx = Math.max(5, Math.min(50, approx));

  const low  = Math.round(Math.max(3, approx - 3));
  const high = Math.round(Math.min(55, approx + 3));

  return `${low}–${high}%`;
}

/**
 * Calculate Fat-Free Mass Index (FFMI).
 * FFMI = (weight_kg × (1 - bodyFat/100)) / height_m²
 * bodyFatMidpoint should be derived from the centre of the estimated range.
 */
export function calculateFFMI(
  weightKg: number,
  heightCm: number,
  bodyFatMidpoint: number
): number {
  const heightM  = heightCm / 100;
  const leanMass = weightKg * (1 - bodyFatMidpoint / 100);
  const ffmi     = leanMass / (heightM * heightM);
  return Math.round(ffmi * 10) / 10;
}

// ─── Sleep Scoring ────────────────────────────────────────────────────────────

/**
 * Maps sleep hours to a 0-100 score.
 * Optimal 7-9h = 100. Penalty for too little or too much.
 * <5h = 20, 5-6h = 50, 6-7h = 75, 7-9h = 100, 9-10h = 80, >10h = 60.
 */
function sleepHoursScore(hours: number): number {
  if (hours <= 0)   return 0;
  if (hours < 5)    return 20;
  if (hours < 6)    return 50;
  if (hours < 7)    return 75;
  if (hours <= 9)   return 100;
  if (hours <= 10)  return 80;
  return 60; // >10h — too much
}

// ─── Sub-Score Calculators ────────────────────────────────────────────────────

function calcNutritionScore(
  allMeals: Meal[],
  calorieTarget: number,
  last7: string[]
): SubScore {
  let daysOnTarget = 0;

  for (const date of last7) {
    const dayMeals  = allMeals.filter((m) => m.date === date);
    const dayCalories = dayMeals.reduce((s, m) => s + m.calories, 0);

    if (dayCalories > 0 && Math.abs(dayCalories - calorieTarget) <= 200) {
      daysOnTarget++;
    }
  }

  const score = Math.round((daysOnTarget / 7) * 100);

  const detail =
    daysOnTarget === 7
      ? 'Perfect — hitting your calorie target every day!'
      : daysOnTarget >= 5
      ? `On target ${daysOnTarget}/7 days — solid consistency.`
      : daysOnTarget >= 3
      ? `On target ${daysOnTarget}/7 days — room to improve.`
      : daysOnTarget > 0
      ? `Only ${daysOnTarget}/7 days within ±200 kcal of target.`
      : 'No meals logged in the past 7 days.';

  return {
    label: 'Nutrition',
    score,
    band: getBand(score),
    weight: 0.30,
    detail,
    icon: '🥗',
  };
}

function calcExerciseScore(allWorkouts: Workout[], last7: string[]): SubScore {
  const workoutsLast7 = allWorkouts.filter((w) => last7.includes(w.date)).length;
  const score = Math.min(100, Math.round((workoutsLast7 / 3) * 100));

  const detail =
    workoutsLast7 >= 5
      ? `${workoutsLast7} workouts this week — outstanding dedication!`
      : workoutsLast7 >= 3
      ? `${workoutsLast7} workouts this week — meeting your target.`
      : workoutsLast7 >= 1
      ? `${workoutsLast7} workout${workoutsLast7 > 1 ? 's' : ''} this week — aim for 3+ for best results.`
      : 'No workouts logged in the past 7 days.';

  return {
    label: 'Exercise',
    score,
    band: getBand(score),
    weight: 0.25,
    detail,
    icon: '💪',
  };
}

function calcSleepScore(sleepLogs: SleepLog[], last7: string[]): SubScore {
  const logsInWindow = sleepLogs.filter((s) => last7.includes(s.date));

  if (logsInWindow.length === 0) {
    return {
      label: 'Sleep',
      score: 0,
      band: 'poor',
      weight: 0.25,
      detail: 'No sleep data logged in the past 7 days.',
      icon: '😴',
    };
  }

  const scores    = logsInWindow.map((s) => sleepHoursScore(s.hours));
  const avgScore  = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const avgHours  = Math.round((logsInWindow.reduce((s, l) => s + l.hours, 0) / logsInWindow.length) * 10) / 10;

  const detail =
    avgScore >= 90
      ? `Averaging ${avgHours}h sleep — excellent recovery!`
      : avgScore >= 70
      ? `Averaging ${avgHours}h sleep — good, but aim for 7-9h.`
      : avgHours < 6
      ? `Averaging only ${avgHours}h — sleep deprivation hurts recovery.`
      : `Averaging ${avgHours}h over ${logsInWindow.length} logged nights.`;

  return {
    label: 'Sleep',
    score: avgScore,
    band: getBand(avgScore),
    weight: 0.25,
    detail,
    icon: '😴',
  };
}

function calcHydrationScore(
  waterLogs: WaterLog[],
  waterTarget: number,
  last7: string[]
): SubScore {
  // Group water logs by date and sum totals
  const dailyTotals = new Map<string, number>();
  for (const log of waterLogs) {
    if (last7.includes(log.date)) {
      dailyTotals.set(log.date, (dailyTotals.get(log.date) ?? 0) + log.amount);
    }
  }

  const daysLogged   = dailyTotals.size;
  const daysOnTarget = [...dailyTotals.values()].filter((total) => total >= waterTarget).length;
  const score        = Math.round((daysOnTarget / 7) * 100);

  const detail =
    daysLogged === 0
      ? 'No hydration data in the past 7 days.'
      : daysOnTarget === 7
      ? `Hit your ${waterTarget}ml target every day — perfectly hydrated!`
      : daysOnTarget >= 5
      ? `Hit water goal ${daysOnTarget}/7 days — keep it up.`
      : `Hit water goal ${daysOnTarget}/${daysLogged} logged days — drink more consistently.`;

  return {
    label: 'Hydration',
    score,
    band: getBand(score),
    weight: 0.20,
    detail,
    icon: '💧',
  };
}

// ─── Insight Generator ────────────────────────────────────────────────────────

function generateInsights(subScores: SubScore[], band: ScoreBand): string[] {
  const insights: string[] = [];

  // Sort sub-scores ascending (worst first)
  const sorted = [...subScores].sort((a, b) => a.score - b.score);

  for (const sub of sorted) {
    if (insights.length >= 3) break;

    if (sub.label === 'Nutrition' && sub.score < 60) {
      insights.push('Log meals daily and stay within ±200 kcal of your calorie target to build consistency.');
    } else if (sub.label === 'Exercise' && sub.score < 60) {
      insights.push('Aim for at least 3 workout sessions per week — even 30-min walks count!');
    } else if (sub.label === 'Sleep' && sub.score < 60) {
      insights.push('Prioritise 7-9 hours of quality sleep — it drives muscle recovery and fat loss.');
    } else if (sub.label === 'Hydration' && sub.score < 60) {
      insights.push(`Drink ${Math.round(sub.score < 30 ? 2000 : 1500)}ml+ of water daily. Set hourly reminders to stay on track.`);
    }
  }

  // Positive reinforcement if doing well
  if (insights.length === 0 && band === 'excellent') {
    insights.push('Outstanding health score! Maintain your current routines and consider adding variety to workouts.');
  } else if (insights.length === 0 && band === 'good') {
    insights.push('Great score! Focus on your lowest pillar to push into the excellent range.');
  }

  // Always cap at 3
  return insights.slice(0, 3);
}

// ─── Main Scoring Function ────────────────────────────────────────────────────

/**
 * Calculates the composite health score from all available data.
 * Returns a full HealthScoreResult ready for display.
 */
export function calculateHealthScore(
  profile: UserProfile,
  allMeals: Meal[],
  allWorkouts: Workout[],
  sleepLogs: SleepLog[],
  waterLogs: WaterLog[]
): HealthScoreResult {
  const last7 = getLast7Days();

  // Calculate each pillar
  const nutritionScore  = calcNutritionScore(allMeals, profile.calorieTarget, last7);
  const exerciseScore   = calcExerciseScore(allWorkouts, last7);
  const sleepScore      = calcSleepScore(sleepLogs, last7);
  const hydrationScore  = calcHydrationScore(waterLogs, profile.waterTarget, last7);

  const subScores: SubScore[] = [nutritionScore, exerciseScore, sleepScore, hydrationScore];

  // Weighted composite
  const overall = Math.round(
    subScores.reduce((sum, s) => sum + s.score * s.weight, 0)
  );

  const band = getBand(overall);

  // BMI
  const bmi         = calculateBMI(profile.weightKg, profile.heightCm);
  const bmiCategory = getBMICategory(bmi);

  // Body fat estimate
  const bodyFatRange = estimateBodyFatRange(profile);

  // FFMI using midpoint of body fat range
  const bmi2 = calculateBMI(profile.weightKg, profile.heightCm);
  let midBF: number;
  if (profile.gender === 'male') {
    midBF = 1.20 * bmi2 + 0.23 * profile.age - 16.2;
  } else {
    midBF = 1.20 * bmi2 + 0.23 * profile.age - 5.4;
  }
  midBF = Math.max(5, Math.min(50, midBF));
  const ffmiEstimate = calculateFFMI(profile.weightKg, profile.heightCm, midBF);

  // Insights
  const insights = generateInsights(subScores, band);

  return {
    overall,
    band,
    subScores,
    insights,
    bodyFatRange,
    ffmiEstimate,
    bmi,
    bmiCategory,
  };
}
