/**
 * FitTrack Personal — Calorie & Weight Forecast Engine
 *
 * Uses 7-day moving averages to project:
 * - Average daily calorie intake
 * - Average daily deficit/surplus
 * - Projected weight change over N days
 * - Estimated date to reach goal weight
 *
 * Uses 7,700 kcal ≈ 1 kg fat rule for weight projections.
 * All math is stateless and pure — safe to call in a render cycle.
 */

import type { Meal, WeightLog, UserProfile } from '../db/database';
import { getLast7Days, getLast30Days } from './helpers';

// ─── Public Interfaces ────────────────────────────────────────────────────────

export interface DailySnapshot {
  date: string;          // YYYY-MM-DD
  calories: number;      // actual logged calories (0 if no meals that day)
  deficit: number;       // positive = deficit, negative = surplus
  projectedWeight?: number; // kg — populated by getProjectedWeightSeries
}

export interface ForecastResult {
  averageDailyCalories: number;
  averageDailyDeficit: number;    // positive = deficit, negative = surplus
  projectedWeeklyChange: number;  // kg change over 7 days (negative = weight loss)
  projectedMonthlyChange: number; // kg change over 30 days
  dailySnapshots: DailySnapshot[];
  trend: 'losing' | 'gaining' | 'maintaining';
  daysToGoalWeight?: number;      // undefined if no goal weight or already there
  confidenceNote: string;         // human-readable caveat
}

// ─── Internal Constants ───────────────────────────────────────────────────────

/** Energy equivalent of 1 kg of body fat in kilocalories */
const KCAL_PER_KG = 7700;

/**
 * "Maintaining" threshold: if average daily deficit is within ±100 kcal,
 * we classify the trend as maintaining.
 */
const MAINTAIN_THRESHOLD_KCAL = 100;

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Build a map of date → total calories from an array of Meal records.
 */
function buildCalorieMap(meals: Meal[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const meal of meals) {
    map.set(meal.date, (map.get(meal.date) ?? 0) + meal.calories);
  }
  return map;
}

/**
 * Find the most recent weight log entry.
 * Returns undefined if weightLogs is empty.
 */
function latestWeight(weightLogs: WeightLog[]): WeightLog | undefined {
  if (weightLogs.length === 0) return undefined;
  return [...weightLogs].sort(
    (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
  )[0];
}

/**
 * Resolve the "current" weight from either the latest log or the profile weight.
 */
function resolveCurrentWeight(weightLogs: WeightLog[], profile: UserProfile): number {
  const latest = latestWeight(weightLogs);
  if (latest) {
    const weightInKg =
      latest.unit === 'lbs' ? latest.weight * 0.453592 : latest.weight;
    return weightInKg;
  }
  return profile.weightKg;
}

/**
 * Compute the average of a numeric array.
 * Returns 0 if the array is empty.
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Build a confidence note based on data availability.
 */
function buildConfidenceNote(
  daysWithData: number,
  totalDaysAnalysed: number,
): string {
  if (totalDaysAnalysed === 0) return 'No data recorded yet — start logging meals to see your forecast.';
  const pct = Math.round((daysWithData / totalDaysAnalysed) * 100);
  if (daysWithData < 3) {
    return `Only ${daysWithData} day(s) of meal data — forecast accuracy improves with more logging.`;
  }
  if (pct < 50) {
    return `Meals logged on ${pct}% of days — consistent daily logging will sharpen this forecast.`;
  }
  if (pct < 80) {
    return `Based on ${daysWithData}/${totalDaysAnalysed} days of data. Moderate confidence.`;
  }
  return `Based on ${daysWithData}/${totalDaysAnalysed} days of data. High confidence forecast.`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculate 7-day moving-average calorie intake and project weight change.
 *
 * Uses the last 30 days of meal history but weights the 7-day window most
 * heavily for the moving average, so recent behaviour dominates the forecast.
 *
 * @param allMeals    All meal records in the database (filtered to last 30d inside)
 * @param weightLogs  All weight log entries
 * @param profile     User profile with calorie target and optional goal weight
 */
export function forecastFromHistory(
  allMeals: Meal[],
  weightLogs: WeightLog[],
  profile: UserProfile,
): ForecastResult {
  const last30 = getLast30Days();  // YYYY-MM-DD strings, oldest → newest
  const last7 = getLast7Days();

  // Build calorie lookup map (only across last 30 days)
  const calorieMap = buildCalorieMap(
    allMeals.filter((m) => last30.includes(m.date)),
  );

  // ── Daily snapshots (last 30 days) ──────────────────────────────────────────
  const dailySnapshots: DailySnapshot[] = last30.map((date) => {
    const calories = calorieMap.get(date) ?? 0;
    // deficit = positive means under target (good for lose), negative = over target
    const deficit = calories > 0 ? profile.calorieTarget - calories : 0;
    return { date, calories, deficit };
  });

  // ── Days with actual data ────────────────────────────────────────────────────
  const daysWithData = dailySnapshots.filter((s) => s.calories > 0).length;

  // ── 7-day moving average for primary forecast ────────────────────────────────
  const last7Calories = last7
    .map((d) => calorieMap.get(d) ?? 0)
    .filter((c) => c > 0); // exclude days with no data from the average

  // Fall back to 30-day average if 7-day window has no data at all
  const last30Calories = last30
    .map((d) => calorieMap.get(d) ?? 0)
    .filter((c) => c > 0);

  const averageDailyCalories =
    last7Calories.length >= 1
      ? mean(last7Calories)
      : last30Calories.length >= 1
        ? mean(last30Calories)
        : 0;

  // ── Average daily deficit ────────────────────────────────────────────────────
  // Only compute on days where data exists (avoid inflating deficit with zero days)
  const averageDailyDeficit =
    averageDailyCalories > 0 ? profile.calorieTarget - averageDailyCalories : 0;

  // ── Projections ──────────────────────────────────────────────────────────────
  // Positive deficit → weight loss (negative kg change), negative → gain
  const projectedWeeklyChange = -(averageDailyDeficit * 7) / KCAL_PER_KG;
  const projectedMonthlyChange = -(averageDailyDeficit * 30) / KCAL_PER_KG;

  // ── Trend classification ──────────────────────────────────────────────────────
  let trend: ForecastResult['trend'];
  if (Math.abs(averageDailyDeficit) <= MAINTAIN_THRESHOLD_KCAL || averageDailyCalories === 0) {
    trend = 'maintaining';
  } else if (averageDailyDeficit > 0) {
    trend = 'losing';
  } else {
    trend = 'gaining';
  }

  // ── Days to goal weight ───────────────────────────────────────────────────────
  let daysToGoalWeight: number | undefined;
  const currentWeight = resolveCurrentWeight(weightLogs, profile);
  const goalWeight = profile.goal === 'lose'
    ? Math.max(0, currentWeight - 5)   // sensible default: 5 kg below current
    : profile.goal === 'gain'
      ? currentWeight + 5              // 5 kg above current
      : undefined;

  if (
    goalWeight !== undefined &&
    averageDailyDeficit !== 0 &&
    averageDailyCalories > 0
  ) {
    const weightDiff = currentWeight - goalWeight; // positive = need to lose
    // weightDiff > 0 + deficit > 0 → losing → makes sense
    // weightDiff < 0 + deficit < 0 → gaining → makes sense
    const kgPerDay = averageDailyDeficit / KCAL_PER_KG; // kg lost per day (positive=loss)
    if (
      (weightDiff > 0 && kgPerDay > 0) || // losing and needs to lose
      (weightDiff < 0 && kgPerDay < 0)    // gaining and needs to gain
    ) {
      const days = Math.abs(weightDiff / kgPerDay);
      daysToGoalWeight = Math.round(days);
    }
  }

  // ── Confidence note ───────────────────────────────────────────────────────────
  const confidenceNote = buildConfidenceNote(daysWithData, last30.length);

  return {
    averageDailyCalories: Math.round(averageDailyCalories),
    averageDailyDeficit: Math.round(averageDailyDeficit),
    projectedWeeklyChange: parseFloat(projectedWeeklyChange.toFixed(2)),
    projectedMonthlyChange: parseFloat(projectedMonthlyChange.toFixed(2)),
    dailySnapshots,
    trend,
    daysToGoalWeight,
    confidenceNote,
  };
}

/**
 * Generate next-7-days projected weight data for chart rendering.
 *
 * Starts from currentWeight at day 0 and applies the daily weight change
 * (derived from dailyDeficit and the 7,700 kcal/kg rule) for each subsequent day.
 *
 * @param currentWeight  Most recent known weight in kg
 * @param dailyDeficit   Average daily calorie deficit (positive = deficit = weight loss)
 * @returns              Array of { day: "Mon", weight: 72.3 } objects for 8 points (today + 7)
 */
export function getProjectedWeightSeries(
  currentWeight: number,
  dailyDeficit: number,
): Array<{ day: string; weight: number }> {
  const kgChangePerDay = dailyDeficit / KCAL_PER_KG; // positive deficit → negative weight change
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  const series: Array<{ day: string; weight: number }> = [];

  for (let i = 0; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayLabel = i === 0 ? 'Today' : DAY_NAMES[date.getDay()];
    const projectedWeight = currentWeight - kgChangePerDay * i;

    series.push({
      day: dayLabel,
      weight: parseFloat(Math.max(0, projectedWeight).toFixed(1)),
    });
  }

  return series;
}
