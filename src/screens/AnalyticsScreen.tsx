import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { getLast7Days, getLast30Days, getDayName, formatDateShort } from '../utils/helpers';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

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
