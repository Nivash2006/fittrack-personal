/**
 * FitTrack Personal — Health Insights Aggregator Engine
 */

import { db } from '../db/database';
import { getLast7Days, calculateBMR, calculateTDEE } from '../utils/helpers';
import { generateCalorieInsights } from './calorieInsights';
import { generateProteinInsights } from './proteinInsights';
import { generateSleepInsights } from './sleepInsights';
import { generateWeightInsights } from './weightInsights';

export type InsightSeverity = 'positive' | 'warning' | 'critical' | 'motivational';

export interface HealthInsight {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  icon: string;
  priority: number; // Lower number = higher priority
}

/**
 * Aggregates all modular insights from local IndexedDB data and picks the top 3 highest priority items.
 */
export async function aggregateHealthInsights(): Promise<HealthInsight[]> {
  try {
    const profile = await db.userProfiles.toCollection().first();
    if (!profile) return [];

    const last7 = getLast7Days();
    const allMeals = await db.meals.toArray();
    const allWorkouts = await db.workouts.toArray();
    const allSleep = await db.sleepLogs.toArray();
    const allSteps = await db.stepLogs.toArray();
    const allWeight = await db.weightLogs.toArray();

    // Calculate baseline TDEE
    const bmr = calculateBMR(profile.gender, profile.weightKg, profile.heightCm, profile.age);
    const tdeeBase = calculateTDEE(bmr, profile.activityLevel);

    // Prepare arrays over rolling 7 days
    const consumedCalories: number[] = [];
    const expendedCalories: number[] = [];
    const proteinIntakes: number[] = [];
    
    const sleepStepsPairs: Array<{
      date: string;
      sleepHours: number;
      stepsCount: number;
      workoutLogged: boolean;
    }> = [];

    for (const date of last7) {
      // 1. Calories & Protein consumed
      const dayMeals = allMeals.filter((m) => m.date === date);
      const consumed = dayMeals.reduce((sum, m) => sum + m.calories, 0);
      const protein = dayMeals.reduce((sum, m) => sum + m.protein, 0);
      
      consumedCalories.push(consumed);
      proteinIntakes.push(protein);

      // 2. Calories burned
      const dayWorkouts = allWorkouts.filter((w) => w.date === date);
      const workoutBurn = dayWorkouts.reduce((sum, w) => {
        const setsBurn = w.sets.reduce((s) => s + 4.5, 0);
        const durationBurn = (w.duration ?? 0) * 9;
        return sum + setsBurn + durationBurn;
      }, 0);

      const daySteps = allSteps.find((s) => s.date === date);
      const stepsCount = daySteps?.count ?? 0;
      const stepsBurn = stepsCount * 0.04;

      const totalActiveBurn = Math.round(workoutBurn + stepsBurn);
      const totalExpenditure = Math.round(tdeeBase + totalActiveBurn);
      expendedCalories.push(totalExpenditure);

      // 3. Sleep & Steps
      const daySleep = allSleep.find((s) => s.date === date);
      const sleepHours = daySleep?.hours ?? 0;

      sleepStepsPairs.push({
        date,
        sleepHours,
        stepsCount,
        workoutLogged: dayWorkouts.length > 0,
      });
    }

    // Generate insights from each module
    const calorieIns = generateCalorieInsights(consumedCalories, expendedCalories, profile.calorieTarget);
    const proteinIns = generateProteinInsights(proteinIntakes, profile.proteinTarget);
    const sleepIns = generateSleepInsights(sleepStepsPairs);
    const weightIns = generateWeightInsights(
      allWeight.map((w) => ({ weight: w.weight, loggedAt: w.loggedAt }))
    );

    // Combine all generated insights
    const allInsights = [...calorieIns, ...proteinIns, ...sleepIns, ...weightIns];

    // Onboarding fallbacks if the user has no logged history yet
    if (allInsights.length === 0) {
      return [
        {
          id: 'welcome_onboarding',
          title: 'Insights Engine Online',
          description: 'Log your meals, workouts, sleep, and weight for 3–5 consecutive days. The engine will automatically generate recovery correlations and deficit progression advice.',
          severity: 'positive',
          icon: '✨',
          priority: 1,
        },
        {
          id: 'protein_onboarding',
          title: 'Focus on Lean Proteins',
          description: `To meet your muscle preservation target of ${profile.proteinTarget}g, plan your main meals around dense protein sources like egg whites, curd, paneer, or chicken.`,
          severity: 'motivational',
          icon: '🍗',
          priority: 2,
        },
        {
          id: 'deficit_onboarding',
          title: 'Daily Deficit Objective',
          description: `Your weight goal suggests a daily target of ${profile.calorieTarget} kcal. Keep a consistent deficit to safely oxidize adipose fat.`,
          severity: 'motivational',
          icon: '🔥',
          priority: 3,
        }
      ];
    }

    // Sort by priority (ascending, i.e. 1 before 2) and take maximum 3 insights
    return allInsights
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3);
  } catch (err) {
    console.error('Failed to aggregate health insights:', err);
    return [];
  }
}
