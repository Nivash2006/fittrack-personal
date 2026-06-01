/**
 * FitTrack Personal — Health Insights Carousel Panel
 */

import { useState, useEffect } from 'react';
import { aggregateHealthInsights, type HealthInsight } from '../insights/insightsAggregator';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';

export default function InsightsPanel() {
  const [insights, setInsights] = useState<HealthInsight[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  // Re-run whenever database meals, weight logs, sleep logs, or steps change
  const mealsCount = useLiveQuery(() => db.meals.count());
  const workoutsCount = useLiveQuery(() => db.workouts.count());
  const weightCount = useLiveQuery(() => db.weightLogs.count());
  const sleepCount = useLiveQuery(() => db.sleepLogs.count());
  const stepsCount = useLiveQuery(() => db.stepLogs.count());

  useEffect(() => {
    const loadInsights = async () => {
      const data = await aggregateHealthInsights();
      setInsights(data);
      setActiveIdx(0);
    };
    loadInsights();
  }, [mealsCount, workoutsCount, weightCount, sleepCount, stepsCount]);

  if (insights.length === 0) return null;

  const currentInsight = insights[activeIdx];

  // Helper to resolve CSS border colors based on severity
  const getSeverityStyle = (severity: HealthInsight['severity']) => {
    switch (severity) {
      case 'positive':
        return {
          borderLeft: '4px solid var(--accent)',
          badgeBackground: 'rgba(0, 230, 138, 0.06)',
          textColor: 'var(--accent)',
        };
      case 'warning':
        return {
          borderLeft: '4px solid #ffb347', // Amber
          badgeBackground: 'rgba(255, 179, 71, 0.06)',
          textColor: '#ffb347',
        };
      case 'critical':
        return {
          borderLeft: '4px solid var(--danger)', // Red
          badgeBackground: 'rgba(255, 77, 106, 0.06)',
          textColor: 'var(--danger)',
        };
      default: // motivational
        return {
          borderLeft: '4px solid #4d8dff', // Blue
          badgeBackground: 'rgba(77, 141, 255, 0.06)',
          textColor: '#4d8dff',
        };
    }
  };

  const styleMeta = getSeverityStyle(currentInsight.severity);

  return (
    <div className="glass-card mb-md animate-in" style={{ padding: 'var(--space-md)', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
        <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
          💡 Smart Health Insights
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {insights.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: i === activeIdx ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Active Insight Card */}
      <div
        className="glass-card animate-in"
        style={{
          background: 'rgba(255,255,255,0.01)',
          padding: 'var(--space-md)',
          borderRadius: 'var(--radius-sm)',
          borderLeft: styleMeta.borderLeft,
          display: 'flex',
          gap: 'var(--space-md)',
          minHeight: 90,
          transition: 'all 0.3s ease',
        }}
      >
        <div
          style={{
            fontSize: '1.75rem',
            background: styleMeta.badgeBackground,
            borderRadius: 'var(--radius-sm)',
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {currentInsight.icon}
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {currentInsight.title}
          </h4>
          <p style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {currentInsight.description}
          </p>
        </div>
      </div>
    </div>
  );
}
