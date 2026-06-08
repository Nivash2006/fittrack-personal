import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { getLast7Days, getLast30Days, getDayName, formatDateShort } from '../utils/helpers';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { calculateHealthScore, getBandColor, type HealthScoreResult } from '../utils/healthScore';
import { forecastFromHistory, getProjectedWeightSeries } from '../utils/calorieForecast';

const CHART_COLORS = {
  calories: '#00e68a',
  protein: '#4d8dff',
  carbs: '#ffb347',
  fats: '#ff4d6a',
  weight: '#00e68a',
};

export default function AnalyticsScreen() {
  const profile = useLiveQuery(() => db.userProfiles.toCollection().first());
  const allMeals = useLiveQuery(() => db.meals.toArray());
  const weightLogs = useLiveQuery(() => db.weightLogs.orderBy('loggedAt').toArray());
  const allWorkouts = useLiveQuery(() => db.workouts.toArray());
  const allSleep = useLiveQuery(() => db.sleepLogs.toArray());
  const allSteps = useLiveQuery(() => db.stepLogs.toArray());
  const allWater = useLiveQuery(() => db.waterLogs.toArray());

  const last7 = getLast7Days();
  const last30 = getLast30Days();

  // Weekly calorie data
  const weeklyCalories = useMemo(() => {
    if (!allMeals) return [];
    return last7.map((date) => {
      const meals = allMeals.filter((m) => m.date === date);
      return {
        day: getDayName(date),
        calories: meals.reduce((s, m) => s + m.calories, 0),
        protein: meals.reduce((s, m) => s + m.protein, 0),
        carbs: meals.reduce((s, m) => s + m.carbs, 0),
        fats: meals.reduce((s, m) => s + m.fats, 0),
        target: profile?.calorieTarget ?? 2000,
      };
    });
  }, [allMeals, last7, profile]);

  // Weight trend
  const weightData = useMemo(() => {
    if (!weightLogs || weightLogs.length === 0) return [];
    return weightLogs.map((l) => ({
      date: formatDateShort(l.loggedAt),
      weight: l.weight,
    }));
  }, [weightLogs]);

  // Macro distribution (averages over last 7 days)
  const macroDistribution = useMemo(() => {
    if (!allMeals) return [];
    const recent = allMeals.filter((m) => last7.includes(m.date));
    const totalP = recent.reduce((s, m) => s + m.protein, 0);
    const totalC = recent.reduce((s, m) => s + m.carbs, 0);
    const totalF = recent.reduce((s, m) => s + m.fats, 0);
    const total = totalP + totalC + totalF;
    if (total === 0) return [];
    return [
      { name: 'Protein', value: Math.round(totalP), color: CHART_COLORS.protein },
      { name: 'Carbs', value: Math.round(totalC), color: CHART_COLORS.carbs },
      { name: 'Fats', value: Math.round(totalF), color: CHART_COLORS.fats },
    ];
  }, [allMeals, last7]);

  // Workout frequency
  const workoutFrequency = useMemo(() => {
    if (!allWorkouts) return [];
    return last7.map((date) => ({
      day: getDayName(date),
      count: allWorkouts.filter((w) => w.date === date).length,
    }));
  }, [allWorkouts, last7]);

  // Sleep data
  const sleepData = useMemo(() => {
    if (!allSleep) return [];
    return last7.map((date) => {
      const log = allSleep.find((s) => s.date === date);
      return { day: getDayName(date), hours: log?.hours ?? 0 };
    });
  }, [allSleep, last7]);

  // Steps data
  const stepsData = useMemo(() => {
    if (!allSteps) return [];
    return last7.map((date) => {
      const log = allSteps.find((s) => s.date === date);
      return { day: getDayName(date), steps: log?.count ?? 0 };
    });
  }, [allSteps, last7]);

  // Health score
  const healthScore = useMemo<HealthScoreResult | null>(() => {
    if (!profile || !allMeals || !allWorkouts || !allSleep || !allWater) return null;
    return calculateHealthScore(profile, allMeals, allWorkouts, allSleep, allWater);
  }, [profile, allMeals, allWorkouts, allSleep, allWater]);

  // Calorie forecast
  const forecast = useMemo(() => {
    if (!allMeals || !weightLogs || !profile) return null;
    return forecastFromHistory(allMeals, weightLogs, profile);
  }, [allMeals, weightLogs, profile]);

  const projectedSeries = useMemo(() => {
    if (!forecast || !weightLogs) return [];
    const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : (profile?.weightKg ?? 70);
    return getProjectedWeightSeries(currentWeight, forecast.averageDailyDeficit);
  }, [forecast, weightLogs, profile]);

  // V2 Trend alerts
  const trendAlerts = useMemo(() => {
    const alerts: string[] = [];
    if (!allMeals || !profile || !allWorkouts || !allSleep || !allWater) return alerts;

    const last3Days = last7.slice(-3);
    let consecutiveUnder = 0;
    let consecutiveOver = 0;
    last3Days.forEach((date) => {
      const dayCal = allMeals.filter((m) => m.date === date).reduce((s, m) => s + m.calories, 0);
      if (dayCal > 0) {
        if (dayCal < profile.calorieTarget * 0.75) consecutiveUnder++;
        if (dayCal > profile.calorieTarget * 1.25) consecutiveOver++;
      }
    });

    if (consecutiveUnder === 3) {
      alerts.push("⚠️ Under-eating trend: Calorie intake has been under 75% of your target for 3 consecutive days.");
    }
    if (consecutiveOver === 3) {
      alerts.push("⚠️ Over-eating trend: Calorie intake has been over 125% of your target for 3 consecutive days.");
    }

    const workoutsLast7 = allWorkouts.filter((w) => last7.includes(w.date)).length;
    if (workoutsLast7 === 0) {
      alerts.push("🏋️ Inactivity warning: You haven't logged any workouts in the last 7 days.");
    }

    const sleepLast7 = allSleep.filter((s) => last7.includes(s.date));
    if (sleepLast7.length > 0) {
      const avgSleep = sleepLast7.reduce((s, log) => s + log.hours, 0) / sleepLast7.length;
      if (avgSleep < 6) {
        alerts.push("💤 Sleep warning: Your average sleep over the last week is under 6 hours.");
      }
    }

    const waterLast7 = allWater.filter((w) => last7.includes(w.date));
    if (waterLast7.length > 0) {
      const avgWater = waterLast7.reduce((s, log) => s + log.amount, 0) / 7;
      if (avgWater < profile.waterTarget * 0.5) {
        alerts.push("💧 Hydration warning: Your average water intake is under 50% of target.");
      }
    }

    return alerts;
  }, [allMeals, allWorkouts, allSleep, allWater, profile, last7]);

  // V2 Heatmap data
  const heatmapData = useMemo(() => {
    if (!allMeals) return [];
    const last30 = getLast30Days();
    return last30.map((date) => {
      const logged = allMeals.some((m) => m.date === date);
      return { date, logged };
    });
  }, [allMeals]);

  // Summary stats
  const avgCalories = weeklyCalories.length > 0
    ? Math.round(weeklyCalories.reduce((s, d) => s + d.calories, 0) / weeklyCalories.length)
    : 0;

  const currentWeight = weightLogs && weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : null;
  const startWeight = weightLogs && weightLogs.length > 0 ? weightLogs[0].weight : null;
  const weightChange = currentWeight && startWeight ? Math.round((currentWeight - startWeight) * 10) / 10 : null;

  const totalWorkouts30 = allWorkouts?.filter((w) => last30.includes(w.date)).length ?? 0;

  const customTooltipStyle = {
    backgroundColor: 'rgba(18, 18, 26, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '0.8125rem',
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-header__title">Analytics</h1>
      </div>

      {/* ── Health Score Section ─────────────────────────────────────── */}
      {healthScore && (
        <div className="glass-card mb-md" style={{ border: `1px solid ${getBandColor(healthScore.band)}40` }}>
          <div className="section-header">
            <span className="section-header__title">🧠 Health Score</span>
            <span style={{ fontSize: '0.75rem', color: getBandColor(healthScore.band), fontWeight: 700, textTransform: 'uppercase' }}>
              {healthScore.band}
            </span>
          </div>

          {/* Ring + Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', marginBottom: 'var(--space-lg)' }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="46" fill="none" stroke="var(--bg-glass-strong)" strokeWidth="10" />
              <circle
                cx="55" cy="55" r="46"
                fill="none"
                stroke={getBandColor(healthScore.band)}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - healthScore.overall / 100)}`}
                transform="rotate(-90 55 55)"
                style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 8px ${getBandColor(healthScore.band)})` }}
              />
              <text x="55" y="51" textAnchor="middle" fill={getBandColor(healthScore.band)} fontSize="22" fontWeight="800" fontFamily="var(--font-display)">
                {healthScore.overall}
              </text>
              <text x="55" y="66" textAnchor="middle" fill="var(--text-muted)" fontSize="11">
                / 100
              </text>
            </svg>
            <div style={{ flex: 1 }}>
              {healthScore.subScores.map((s) => (
                <div key={s.label} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{s.icon} {s.label}</span>
                    <span style={{ color: getBandColor(s.band), fontWeight: 700 }}>{s.score}</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--bg-glass-strong)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${s.score}%`, background: getBandColor(s.band), borderRadius: '99px', transition: 'width 600ms ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          {healthScore.insights.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-md)' }}>
              {healthScore.insights.map((insight, i) => (
                <div key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent2)' }}>
                  {insight}
                </div>
              ))}
            </div>
          )}

          {/* Body Composition */}
          {(healthScore.bodyFatRange || healthScore.ffmiEstimate) && (
            <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-subtle)' }}>
              {healthScore.bodyFatRange && (
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Est. Body Fat</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent2)' }}>
                    {healthScore.bodyFatRange}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>estimated range</div>
                </div>
              )}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BMI</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {healthScore.bmi}
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{healthScore.bmiCategory}</div>
              </div>
              {healthScore.ffmiEstimate && (
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FFMI</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent3)' }}>
                    {healthScore.ffmiEstimate}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>fat-free mass idx</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Trend Alerts panel ────────────────────────────────────────── */}
      {trendAlerts.length > 0 && (
        <div className="glass-card mb-md" style={{ border: '1px solid rgba(255, 77, 106, 0.15)', background: 'rgba(255, 77, 106, 0.02)' }}>
          <div className="section-header" style={{ marginBottom: 'var(--space-sm)' }}>
            <span className="section-header__title" style={{ color: 'var(--danger)' }}>⚠️ Trend Alerts & Warnings</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {trendAlerts.map((alert, i) => (
              <div key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {alert}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Calorie Forecast ─────────────────────────────────────────── */}
      {forecast && (
        <div className="glass-card mb-md">
          <div className="section-header">
            <span className="section-header__title">📈 7-Day Weight Forecast</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: forecast.trend === 'losing' ? 'var(--accent)' : forecast.trend === 'gaining' ? 'var(--accent3)' : 'var(--accent2)' }}>
              {forecast.trend === 'losing' ? '↓ Losing' : forecast.trend === 'gaining' ? '↑ Gaining' : '→ Stable'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg Daily</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent)' }}>{Math.round(forecast.averageDailyCalories)} kcal</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Proj. 7d</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: forecast.projectedWeeklyChange < 0 ? 'var(--accent)' : 'var(--accent3)' }}>
                {forecast.projectedWeeklyChange > 0 ? '+' : ''}{forecast.projectedWeeklyChange.toFixed(2)} kg
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Proj. 30d</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent2)' }}>
                {forecast.projectedMonthlyChange > 0 ? '+' : ''}{forecast.projectedMonthlyChange.toFixed(1)} kg
              </div>
            </div>
          </div>
          {projectedSeries.length > 0 && (
            <div style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectedSeries}>
                  <XAxis dataKey="day" tick={{ fill: '#9a9ab0', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} hide />
                  <Tooltip contentStyle={customTooltipStyle} formatter={(v: any) => [typeof v === 'number' ? `${v.toFixed(1)} kg` : `${v} kg`, 'Weight']} />
                  <Line type="monotone" dataKey="weight" stroke="var(--accent2)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 'var(--space-sm)', textAlign: 'center' }}>
            {forecast.confidenceNote}
          </div>
        </div>
      )}

      {/* ── Meal Logging Consistency Heatmap ──────────────────────────── */}
      {heatmapData.length > 0 && (
        <div className="glass-card mb-md">
          <div className="section-header" style={{ marginBottom: 'var(--space-md)' }}>
            <span className="section-header__title">📅 30-Day Logging Consistency</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', maxWidth: '280px', margin: '0 auto' }}>
            {heatmapData.map((d, i) => (
              <div 
                key={i}
                style={{
                  aspectRatio: '1',
                  background: d.logged ? 'var(--accent)' : 'var(--bg-glass-strong)',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.03)',
                  boxShadow: d.logged ? '0 0 6px var(--accent-glow)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.625rem',
                  color: d.logged ? '#0a1a12' : 'var(--text-muted)',
                  fontWeight: 700
                }}
                title={`${d.date}: ${d.logged ? 'Logged' : 'No entries'}`}
              >
                {new Date(d.date).getDate()}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-md)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bg-glass-strong)' }} /> Not Logged
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)' }} /> Logged
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="stats-grid mb-md">
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div className="text-caption">Avg Daily Cal</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>
            {avgCalories}
          </div>
          <div className="text-small text-muted">kcal / 7 days</div>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div className="text-caption">Weight Change</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800,
            color: weightChange === null ? 'var(--text-muted)' : weightChange <= 0 ? 'var(--accent)' : 'var(--accent3)',
          }}>
            {weightChange !== null ? `${weightChange > 0 ? '+' : ''}${weightChange}` : '—'}
          </div>
          <div className="text-small text-muted">kg overall</div>
        </div>
      </div>

      <div className="stats-grid mb-md">
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div className="text-caption">Workouts (30d)</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent2)' }}>
            {totalWorkouts30}
          </div>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div className="text-caption">Current Weight</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {currentWeight ?? '—'}
          </div>
          <div className="text-small text-muted">kg</div>
        </div>
      </div>

      {/* Weekly Calories Chart */}
      <div className="glass-card mb-md">
        <div className="section-header">
          <span className="section-header__title">📊 Weekly Calories</span>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyCalories}>
              <XAxis dataKey="day" tick={{ fill: '#9a9ab0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="calories" fill={CHART_COLORS.calories} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weight Trend */}
      {weightData.length > 0 && (
        <div className="glass-card mb-md">
          <div className="section-header">
            <span className="section-header__title">⚖️ Weight Trend</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightData}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.weight} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.weight} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#9a9ab0', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                <Tooltip contentStyle={customTooltipStyle} />
                <Area type="monotone" dataKey="weight" stroke={CHART_COLORS.weight} fill="url(#weightGrad)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Macro Distribution */}
      {macroDistribution.length > 0 && (
        <div className="glass-card mb-md">
          <div className="section-header">
            <span className="section-header__title">🥧 Macro Split (7 Days)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
            <div style={{ width: 130, height: 130 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={macroDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    dataKey="value"
                    stroke="none"
                  >
                    {macroDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {macroDistribution.map((m) => (
                <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: m.color }} />
                  <span className="text-small">{m.name}</span>
                  <span className="text-small text-muted">{m.value}g</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Workout Frequency */}
      <div className="glass-card mb-md">
        <div className="section-header">
          <span className="section-header__title">💪 Workout Frequency</span>
        </div>
        <div className="chart-container" style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workoutFrequency}>
              <XAxis dataKey="day" tick={{ fill: '#9a9ab0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={customTooltipStyle} />
              <Bar dataKey="count" fill={CHART_COLORS.protein} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sleep Chart */}
      <div className="glass-card mb-md">
        <div className="section-header">
          <span className="section-header__title">😴 Sleep (7 Days)</span>
        </div>
        <div className="chart-container" style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sleepData}>
              <XAxis dataKey="day" tick={{ fill: '#9a9ab0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={customTooltipStyle} />
              <Bar dataKey="hours" fill="#a78bfa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Steps Chart */}
      <div className="glass-card mb-lg">
        <div className="section-header">
          <span className="section-header__title">👟 Steps (7 Days)</span>
        </div>
        <div className="chart-container" style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stepsData}>
              <defs>
                <linearGradient id="stepsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffb347" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ffb347" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#9a9ab0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={customTooltipStyle} />
              <Area type="monotone" dataKey="steps" stroke="#ffb347" fill="url(#stepsGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
