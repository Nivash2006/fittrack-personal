/**
 * FitTrack Personal — Protein Intake Insight Generator
 */

import { type HealthInsight } from './insightsAggregator';

/**
 * Evaluates the user's protein intake over the last 7 days.
 */
export function generateProteinInsights(
  proteinLogs: number[],
  proteinTarget: number
): HealthInsight[] {
  if (proteinLogs.length === 0) return [];

  const avgProtein = Math.round(proteinLogs.reduce((s, p) => s + p, 0) / proteinLogs.length);
  const percentOfTarget = Math.round((avgProtein / proteinTarget) * 100);
  const insights: HealthInsight[] = [];

  if (percentOfTarget >= 95 && percentOfTarget <= 115) {
    insights.push({
      id: 'protein_target_hit',
      title: 'Protein Target Nailed',
      description: `You averaged ${avgProtein}g of protein daily (${percentOfTarget}% of target). Excellent work — this provides your muscles with the building blocks they need to recover and rebuild.`,
      severity: 'positive',
      icon: '🍗',
      priority: 2,
    });
  } else if (percentOfTarget < 85) {
    const diff = Math.round(proteinTarget - avgProtein);
    insights.push({
      id: 'protein_target_low',
      title: 'Protein Intake Deficient',
      description: `You are averaging ${avgProtein}g of protein, which is ${diff}g below your target. Consider adding lean protein sources like egg whites, low-fat thick curd, paneer, or soya chunks to meals.`,
      severity: 'warning',
      icon: '🥚',
      priority: 2,
    });
  } else if (percentOfTarget > 120) {
    insights.push({
      id: 'protein_target_excess',
      title: 'Optimal High-Protein Diet',
      description: `Your average protein is extremely high (${avgProtein}g). While safe, ensure you are drinking sufficient water (~3L daily) to assist kidney filtration and metabolic processing.`,
      severity: 'motivational',
      icon: '💧',
      priority: 5,
    });
  }

  return insights;
}
