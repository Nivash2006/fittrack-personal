/**
 * FitTrack Personal — Weight Progression & Moving Average Insight Generator
 */

import { type HealthInsight } from './insightsAggregator';

interface WeightLogPoint {
  weight: number;
  loggedAt: string; // YYYY-MM-DD
}

/**
 * Generates weight-trend insights using rolling averages to filter out daily noise.
 */
export function generateWeightInsights(weightLogs: WeightLogPoint[]): HealthInsight[] {
  if (weightLogs.length < 3) return [];

  // Sort chronologically
  const sorted = [...weightLogs].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));

  // Get older logs vs newer logs
  const half = Math.ceil(sorted.length / 2);
  const olderLogs = sorted.slice(0, half);
  const newerLogs = sorted.slice(half);

  const avgOlder = olderLogs.reduce((s, l) => s + l.weight, 0) / olderLogs.length;
  const avgNewer = newerLogs.reduce((s, l) => s + l.weight, 0) / newerLogs.length;
  
  const delta = Math.round((avgNewer - avgOlder) * 100) / 100;
  const insights: HealthInsight[] = [];

  if (delta <= -0.2 && delta >= -0.8) {
    insights.push({
      id: 'weight_loss_ideal',
      title: 'Optimal Weight Loss Velocity',
      description: `Your rolling weight average is down by ${Math.abs(delta)} kg. This indicates that your calorie deficit is perfectly dialed in, facilitating fat loss while preserving skeletal muscle.`,
      severity: 'positive',
      icon: '⚖️',
      priority: 1,
    });
  } else if (delta < -0.8) {
    insights.push({
      id: 'weight_loss_rapid',
      title: 'Rapid Weight Loss Warning',
      description: `Your weight trend is down rapidly (-${Math.abs(delta)} kg). Ensure you are consuming adequate protein and not crash dieting, which can trigger metabolic slowdown.`,
      severity: 'warning',
      icon: '⚠️',
      priority: 2,
    });
  } else if (Math.abs(delta) < 0.2) {
    insights.push({
      id: 'weight_maintenance',
      title: 'Weight Stabilization',
      description: `Your weight average is virtually stable (change of ${delta > 0 ? '+' : ''}${delta} kg). If your goal is weight loss, re-evaluate portion accuracy or increase daily activity (NEAT).`,
      severity: 'motivational',
      icon: '📋',
      priority: 3,
    });
  } else if (delta > 0.2) {
    insights.push({
      id: 'weight_gain_insight',
      title: 'Weight Trend Increasing',
      description: `Your rolling weight average has increased by ${delta} kg. If you are in a building phase, this represents ideal muscle mass support. For weight loss, decrease calories by 150 kcal.`,
      severity: 'warning',
      icon: '📈',
      priority: 2,
    });
  }

  return insights;
}
