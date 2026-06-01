/**
 * FitTrack Personal — Calorie & Deficit Insight Generator
 */

import { type HealthInsight } from './insightsAggregator';

/**
 * Evaluates the user's calorie logs over the last 7 days to generate insights.
 */
export function generateCalorieInsights(
  consumedCalories: number[],
  expenditures: number[],
  calorieTarget: number
): HealthInsight[] {
  if (consumedCalories.length === 0) return [];

  const avgConsumed = Math.round(consumedCalories.reduce((s, c) => s + c, 0) / consumedCalories.length);
  const avgExpended = expenditures.length > 0
    ? Math.round(expenditures.reduce((s, e) => s + e, 0) / expenditures.length)
    : calorieTarget + 500; // Fallback estimate

  const avgDeficit = avgExpended - avgConsumed;
  const insights: HealthInsight[] = [];

  if (avgDeficit >= 500 && avgDeficit <= 800) {
    insights.push({
      id: 'calorie_deficit_ideal',
      title: 'Ideal Calorie Deficit',
      description: `Your 7-day average deficit is ${avgDeficit} kcal. You are on track to lose approximately ${Math.round((avgDeficit * 7) / 7700 * 10) / 10} kg of body fat this week in a safe, sustainable manner.`,
      severity: 'positive',
      icon: '🔥',
      priority: 1,
    });
  } else if (avgDeficit > 800) {
    insights.push({
      id: 'calorie_deficit_extreme',
      title: 'Extreme Deficit Warning',
      description: `Your 7-day average deficit of ${avgDeficit} kcal is very high. Consuming too few calories can lead to muscle wasting, fatigue, and metabolic slowing. Consider adding a small snack to support recovery.`,
      severity: 'warning',
      icon: '⚠️',
      priority: 2,
    });
  } else if (avgDeficit > 0 && avgDeficit < 300) {
    insights.push({
      id: 'calorie_deficit_low',
      title: 'Moderate Deficit Progress',
      description: `Your average deficit of ${avgDeficit} kcal is slightly low for optimal fat loss. Increasing your physical activity (such as targetting 10,000 steps daily) will naturally widen the deficit without cutting food.`,
      severity: 'motivational',
      icon: '👟',
      priority: 3,
    });
  } else if (avgDeficit <= 0) {
    insights.push({
      id: 'calorie_deficit_surplus',
      title: 'Calorie Surplus Warning',
      description: `You are in a net calorie surplus (averaging +${Math.abs(avgDeficit)} kcal/day). If your goal is weight loss, double-check your portion sizes or increase daily step counts.`,
      severity: 'critical',
      icon: '⚖️',
      priority: 1,
    });
  }

  // General consistency check
  if (Math.abs(avgConsumed - calorieTarget) < 150) {
    insights.push({
      id: 'calorie_consistency',
      title: 'Superb Calorie Control',
      description: `You are averaging ${avgConsumed} kcal daily, which aligns closely with your macro targets. Consistent intake is the single most important factor for progress.`,
      severity: 'positive',
      icon: '🎯',
      priority: 4,
    });
  }

  return insights;
}
