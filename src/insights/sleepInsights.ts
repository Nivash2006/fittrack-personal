/**
 * FitTrack Personal — Sleep & Activity Correlation Insight Generator
 */

import { type HealthInsight } from './insightsAggregator';

interface DailyActivityPair {
  date: string;
  sleepHours: number;
  stepsCount: number;
  workoutLogged: boolean;
}

/**
 * Evaluates the correlation between sleep and physical activity metrics over the last 7 days.
 */
export function generateSleepInsights(daysData: DailyActivityPair[]): HealthInsight[] {
  if (daysData.length < 3) return [];

  const goodSleepDays = daysData.filter((d) => d.sleepHours >= 7.5);

  const insights: HealthInsight[] = [];

  // 1. Analyze if days with good sleep align with higher step counts
  if (goodSleepDays.length > 0) {
    const avgStepsGoodSleep = Math.round(
      goodSleepDays.reduce((sum, d) => sum + d.stepsCount, 0) / goodSleepDays.length
    );
    
    const otherDays = daysData.filter((d) => d.sleepHours > 0 && d.sleepHours < 7.5);
    const avgStepsOther = otherDays.length > 0
      ? Math.round(otherDays.reduce((sum, d) => sum + d.stepsCount, 0) / otherDays.length)
      : 0;

    const stepsDiff = avgStepsGoodSleep - avgStepsOther;

    if (stepsDiff > 1000) {
      insights.push({
        id: 'sleep_steps_correlation',
        title: 'Sleep & Step Alignment',
        description: `Days with higher sleep (averaging ${goodSleepDays[0].sleepHours.toFixed(1)} hrs) tended to align with stronger activity consistency, yielding an extra ${stepsDiff} steps/day.`,
        severity: 'positive',
        icon: '💤',
        priority: 3,
      });
    }
  }

  // 2. Alert if sleep is consistently deficient
  const avgSleep = daysData.reduce((sum, d) => sum + d.sleepHours, 0) / daysData.filter(d => d.sleepHours > 0).length;
  if (!isNaN(avgSleep) && avgSleep < 6.2 && daysData.filter(d => d.sleepHours > 0).length >= 3) {
    insights.push({
      id: 'sleep_deprived_alert',
      title: 'Sleep Deficiency Warning',
      description: `Your average sleep is only ${avgSleep.toFixed(1)} hours. Consuming calories in a deficit without proper recovery increases cortisol levels and lean muscle breakdown. Target 7+ hours.`,
      severity: 'critical',
      icon: '😴',
      priority: 2,
    });
  }

  // 3. Motivational note if sleep is consistently excellent
  if (!isNaN(avgSleep) && avgSleep >= 7.5 && daysData.filter(d => d.sleepHours > 0).length >= 3) {
    insights.push({
      id: 'sleep_excellent',
      title: 'Excellent Recovery Hygiene',
      description: `Your average sleep is a solid ${avgSleep.toFixed(1)} hours. Prioritizing rest enhances growth hormone release, maximizing fat oxidation and muscle repair.`,
      severity: 'positive',
      icon: '🧘',
      priority: 4,
    });
  }

  return insights;
}
