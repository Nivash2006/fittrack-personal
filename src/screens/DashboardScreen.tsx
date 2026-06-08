import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import CircularProgress from '../components/CircularProgress';
import MacroBar from '../components/MacroBar';
import DeviceConnectionCard from '../components/DeviceConnectionCard';
import InsightsPanel from '../components/InsightsPanel';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { getTodayStr, getGreeting, getLast7Days, getDayName } from '../utils/helpers';
import { getSuggestedMeals } from '../utils/mealSuggestion';
import { forecastFromHistory, getProjectedWeightSeries } from '../utils/calorieForecast';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardScreen() {
  const today = getTodayStr();
  const profile = useLiveQuery(() => db.userProfiles.toCollection().first());
  const todayMeals = useLiveQuery(() => db.meals.where('date').equals(today).toArray(), [today]);
  const todayWater = useLiveQuery(() => db.waterLogs.where('date').equals(today).toArray(), [today]);
  const habits = useLiveQuery(() => db.habits.toArray());
  const weightLogs = useLiveQuery(() => db.weightLogs.orderBy('loggedAt').reverse().limit(7).toArray());
  const todaySleep = useLiveQuery(() => db.sleepLogs.where('date').equals(today).first(), [today]);
  const todaySteps = useLiveQuery(() => db.stepLogs.where('date').equals(today).first(), [today]);

  // V2 suggestions & forecast queries
  const allMeals = useLiveQuery(() => db.meals.toArray());
  const allWeightLogs = useLiveQuery(() => db.weightLogs.orderBy('loggedAt').toArray());

  const [waterGlasses, setWaterGlasses] = useState(0);
  const [sleepHours, setSleepHours] = useState('');
  const [stepCount, setStepCount] = useState('');
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // V2 memoized computations
  const nextMealType = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 16) return 'lunch';
    if (hour < 20) return 'dinner';
    return 'snack';
  }, []);

  const suggestions = useMemo(() => {
    if (!profile || !todayMeals) return [];
    return getSuggestedMeals(profile, todayMeals, nextMealType, 3);
  }, [profile, todayMeals, nextMealType]);

  const forecast = useMemo(() => {
    if (!allMeals || !allWeightLogs || !profile) return null;
    return forecastFromHistory(allMeals, allWeightLogs, profile);
  }, [allMeals, allWeightLogs, profile]);

  const projectedSeries = useMemo(() => {
    if (!forecast || !allWeightLogs || !profile) return [];
    const currentWeight = allWeightLogs.length > 0 ? allWeightLogs[allWeightLogs.length - 1].weight : profile.weightKg;
    return getProjectedWeightSeries(currentWeight, forecast.averageDailyDeficit);
  }, [forecast, allWeightLogs, profile]);

  // V2 suggestion logger
  const handleLogSuggestion = useCallback(async (suggestion: any) => {
    if (!profile) return;
    await db.meals.add({
      foodName: suggestion.food.name,
      mealType: nextMealType,
      quantity: suggestion.servingGrams,
      calories: Math.round(suggestion.calories),
      protein: Math.round(suggestion.protein * 10) / 10,
      carbs: Math.round(suggestion.carbs * 10) / 10,
      fats: Math.round(suggestion.fats * 10) / 10,
      date: today,
      createdAt: new Date().toISOString(),
    });
    setToast(`Added ${suggestion.food.name} (${suggestion.servingGrams}g) to ${nextMealType}!`);
  }, [nextMealType, today, profile]);

  useEffect(() => {
    if (todayWater) {
      const total = todayWater.reduce((s, w) => s + w.amount, 0);
      setWaterGlasses(Math.floor(total / 250));
    }
  }, [todayWater]);

  useEffect(() => {
    if (todaySleep) setSleepHours(String(todaySleep.hours));
  }, [todaySleep]);

  useEffect(() => {
    if (todaySteps) setStepCount(String(todaySteps.count));
  }, [todaySteps]);

  const totalCalories = todayMeals?.reduce((s, m) => s + m.calories, 0) ?? 0;
  const totalProtein = todayMeals?.reduce((s, m) => s + m.protein, 0) ?? 0;
  const totalCarbs = todayMeals?.reduce((s, m) => s + m.carbs, 0) ?? 0;
  const totalFats = todayMeals?.reduce((s, m) => s + m.fats, 0) ?? 0;

  const addWaterGlass = useCallback(async () => {
    await db.waterLogs.add({
      amount: 250,
      date: today,
      createdAt: new Date().toISOString(),
    });
  }, [today]);

  const saveSleep = useCallback(async () => {
    const h = parseFloat(sleepHours);
    if (isNaN(h) || h <= 0) return;
    if (todaySleep?.id) {
      await db.sleepLogs.update(todaySleep.id, { hours: h });
    } else {
      await db.sleepLogs.add({ hours: h, quality: h >= 7 ? 'good' : h >= 5 ? 'fair' : 'poor', date: today });
    }
  }, [sleepHours, today, todaySleep]);

  const saveSteps = useCallback(async () => {
    const c = parseInt(stepCount);
    if (isNaN(c) || c < 0) return;
    if (todaySteps?.id) {
      await db.stepLogs.update(todaySteps.id, { count: c });
    } else {
      await db.stepLogs.add({ count: c, date: today });
    }
  }, [stepCount, today, todaySteps]);

  const toggleHabit = useCallback(async (habitId: number) => {
    const habit = await db.habits.get(habitId);
    if (!habit) return;
    const dates = habit.completedDates || [];
    const idx = dates.indexOf(today);
    if (idx >= 0) {
      dates.splice(idx, 1);
    } else {
      dates.push(today);
    }
    await db.habits.update(habitId, { completedDates: dates });
  }, [today]);

  const handleLogWeight = useCallback(async () => {
    const w = parseFloat(newWeight);
    if (isNaN(w) || w <= 0) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString();

    // 1. Conflict Resolution Check: Ignore if duplicate weight logged today
    const isDuplicate = await db.weightLogs
      .where('[loggedAt+weight]')
      .equals([todayStr, w])
      .first();

    if (isDuplicate) {
      setToast('Weight already logged for today.');
      setNewWeight('');
      setShowWeightModal(false);
      return;
    }

    const logId = await db.weightLogs.add({
      weight: w,
      unit: 'kg',
      source: 'manual',
      loggedAt: todayStr,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending'
    });

    await db.syncQueue.add({
      entityType: 'weightLogs',
      entityId: logId,
      operation: 'create',
      createdAt: timestamp,
      retryCount: 0
    });

    if (profile?.id) {
      await db.userProfiles.update(profile.id, { weightKg: w });
    }
    setToast(`Weight logged: ${w} kg`);
    setNewWeight('');
    setShowWeightModal(false);
  }, [newWeight, profile]);

  if (!profile) return null;

  const last7 = getLast7Days();

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header__greeting">{getGreeting()}, {profile.name} 👋</div>
        <h1 className="page-header__title">Dashboard</h1>
      </div>

      {/* Health Insights Carousel */}
      <InsightsPanel />

      {/* Calorie Ring */}
      <div className="glass-card mb-md" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)' }}>
        <CircularProgress
          value={totalCalories}
          max={profile.calorieTarget}
          size={140}
          strokeWidth={10}
          color="var(--accent)"
          unit="kcal"
        />
        <div style={{ flex: 1 }}>
          <div className="text-caption mb-sm">Daily Target</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700 }}>
            {profile.calorieTarget} <span className="text-muted" style={{ fontSize: '0.875rem', fontWeight: 400 }}>kcal</span>
          </div>
          <div className="text-small text-secondary mt-sm">
            {Math.max(0, profile.calorieTarget - totalCalories)} remaining
          </div>
        </div>
      </div>

      {/* Macros */}
      <div className="glass-card mb-md">
        <div className="section-header">
          <span className="section-header__title">Macros</span>
        </div>
        <div className="macro-stats">
          <MacroBar label="Protein" value={totalProtein} max={profile.proteinTarget} type="protein" />
          <MacroBar label="Carbs" value={totalCarbs} max={profile.carbTarget} type="carbs" />
          <MacroBar label="Fats" value={totalFats} max={profile.fatTarget} type="fats" />
        </div>
      </div>

      {/* Smart Suggestions */}
      {suggestions.length > 0 && (
        <div className="glass-card mb-md">
          <div className="section-header" style={{ marginBottom: 'var(--space-md)' }}>
            <span className="section-header__title">💡 Smart Suggestions ({nextMealType})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {suggestions.map((s, i) => (
              <div key={i} className="meal-card" style={{ padding: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{s.food.name}</span>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleLogSuggestion(s)}
                      style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid rgba(0,230,138,0.15)' }}
                    >
                      + Log {s.servingGrams}g
                    </button>
                  </div>
                  <div className="meal-card__meta" style={{ marginBottom: 6 }}>
                    {Math.round(s.calories)} kcal · P: {Math.round(s.protein)}g · C: {Math.round(s.carbs)}g · F: {Math.round(s.fats)}g
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {s.reasons.map((r, ri) => (
                      <span key={ri} style={{ fontSize: '0.6875rem', color: 'var(--accent2)', background: 'rgba(77, 141, 255, 0.08)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        {r.icon} {r.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="stats-grid mb-md">
        {/* Water */}
        <div className="glass-card">
          <div className="section-header">
            <span className="section-header__title">💧 Water</span>
          </div>
          <div className="water-drops">
            {Array.from({ length: 8 }).map((_, i) => (
              <button
                key={i}
                className={`water-drop ${i < waterGlasses ? 'filled' : ''}`}
                onClick={i === waterGlasses ? addWaterGlass : undefined}
                title={`Glass ${i + 1}`}
              >
                💧
              </button>
            ))}
          </div>
          <div className="text-small text-secondary mt-sm">
            {waterGlasses * 250}ml / {profile.waterTarget}ml
          </div>
        </div>

        {/* Sleep & Steps */}
        <div className="glass-card">
          <div className="form-group">
            <label className="form-label">😴 Sleep (hrs)</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="number"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                placeholder="7"
                style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                step="0.5"
                min="0"
                max="24"
              />
              <button className="btn btn-secondary btn-sm" onClick={saveSleep}>✓</button>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">👟 Steps</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="number"
                value={stepCount}
                onChange={(e) => setStepCount(e.target.value)}
                placeholder="5000"
                style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                min="0"
              />
              <button className="btn btn-secondary btn-sm" onClick={saveSteps}>✓</button>
            </div>
          </div>
        </div>
      </div>

      {/* Habits */}
      <div className="glass-card mb-md">
        <div className="section-header">
          <span className="section-header__title">🔥 Habits</span>
          <AddHabitButton />
        </div>
        {(!habits || habits.length === 0) ? (
          <div className="text-small text-muted text-center" style={{ padding: 'var(--space-md)' }}>
            No habits yet. Add one to start tracking!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {habits.map((habit) => {
              const streak = calculateStreak(habit.completedDates, today);
              const doneToday = habit.completedDates?.includes(today);
              return (
                <div
                  key={habit.id}
                  className="meal-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => habit.id && toggleHabit(habit.id)}
                >
                  <div
                    className="meal-card__icon"
                    style={{
                      background: doneToday ? 'var(--accent-dim)' : 'var(--bg-glass-strong)',
                      fontSize: '1.5rem',
                    }}
                  >
                    {doneToday ? '✅' : (habit.icon || '⭐')}
                  </div>
                  <div className="meal-card__info">
                    <div className="meal-card__name">{habit.title}</div>
                    <div className="meal-card__meta">
                      {streak > 0 ? `🔥 ${streak} day streak` : 'Tap to complete'}
                    </div>
                  </div>
                  {/* Mini grid for last 7 days */}
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {last7.map((d) => (
                      <div
                        key={d}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: habit.completedDates?.includes(d) ? 'var(--accent)' : 'var(--bg-glass-strong)',
                        }}
                        title={getDayName(d)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Smart Scale Connection Card */}
      <DeviceConnectionCard onManualLogClick={() => setShowWeightModal(true)} />

      {/* Weight Trend */}
      <div className="glass-card mb-md">
        <div className="section-header">
          <span className="section-header__title">⚖️ Weight Trend</span>
        </div>
        {(!weightLogs || weightLogs.length === 0) ? (
          <div className="text-small text-muted text-center" style={{ padding: 'var(--space-md)' }}>
            No weight entries yet. Log your first weight!
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: 80 }}>
            {weightLogs.slice().reverse().map((log, i) => {
              const min = Math.min(...weightLogs.map(l => l.weight));
              const max = Math.max(...weightLogs.map(l => l.weight));
              const range = max - min || 1;
              const h = ((log.weight - min) / range) * 60 + 20;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${h}%`,
                    background: 'linear-gradient(to top, var(--accent), var(--accent2))',
                    borderRadius: '4px 4px 0 0',
                    position: 'relative',
                    minWidth: 20,
                  }}
                  title={`${log.weight} kg`}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: -18,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '0.625rem',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {log.weight}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7-Day Forecast */}
      {forecast && (
        <div className="glass-card mb-md">
          <div className="section-header" style={{ marginBottom: 'var(--space-sm)' }}>
            <span className="section-header__title">📈 7-Day Weight Forecast</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: forecast.trend === 'losing' ? 'var(--accent)' : 'var(--accent3)' }}>
              {forecast.trend === 'losing' ? '↓ Losing' : forecast.trend === 'gaining' ? '↑ Gaining' : '→ Stable'}
            </span>
          </div>
          
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
            Based on your 7-day average calorie deficit, you are projected to change by{' '}
            <strong style={{ color: forecast.projectedWeeklyChange < 0 ? 'var(--accent)' : 'var(--accent3)' }}>
              {forecast.projectedWeeklyChange.toFixed(2)} kg
            </strong>{' '}
            this week.
          </div>

          {projectedSeries.length > 0 && (
            <div style={{ height: 100, marginTop: 'var(--space-sm)' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectedSeries}>
                  <XAxis dataKey="day" tick={{ fill: '#9a9ab0', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['dataMin - 0.2', 'dataMax + 0.2']} hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(18, 18, 26, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                    formatter={(v: any) => [`${Number(v).toFixed(1)} kg`, 'Weight']} 
                  />
                  <Line type="monotone" dataKey="weight" stroke="var(--accent2)" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Recent Meals */}
      <div className="glass-card mb-lg">
        <div className="section-header">
          <span className="section-header__title">🍽️ Today's Meals</span>
        </div>
        {(!todayMeals || todayMeals.length === 0) ? (
          <div className="text-small text-muted text-center" style={{ padding: 'var(--space-md)' }}>
            No meals logged today. Head to the Diet tab!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {todayMeals.slice(0, 5).map((meal) => (
              <div key={meal.id} className="meal-card">
                <div className="meal-card__icon" style={{ background: 'var(--accent-dim)' }}>
                  {mealTypeIcon(meal.mealType)}
                </div>
                <div className="meal-card__info">
                  <div className="meal-card__name">{meal.foodName}</div>
                  <div className="meal-card__meta">{meal.quantity}g · {meal.mealType}</div>
                </div>
                <div className="meal-card__calories">{meal.calories}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Weight Log Modal */}
      <Modal isOpen={showWeightModal} onClose={() => setShowWeightModal(false)} title="Log Weight Manually">
        <div className="form-group">
          <label className="form-label">Current Weight (kg)</label>
          <input
            type="number"
            placeholder={profile ? String(profile.weightKg) : '70'}
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            step="0.1"
            autoFocus
          />
        </div>
        <button className="btn btn-primary btn-block mt-md" onClick={handleLogWeight}>
          Log Weight
        </button>
      </Modal>

      {/* Toast Alert */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function mealTypeIcon(type: string): string {
  switch (type) {
    case 'breakfast': return '🌅';
    case 'lunch': return '☀️';
    case 'dinner': return '🌙';
    case 'snack': return '🍪';
    default: return '🍽️';
  }
}

function calculateStreak(dates: string[] | undefined, today: string): number {
  if (!dates || dates.length === 0) return 0;
  const sorted = [...dates].sort().reverse();
  let streak = 0;
  const current = new Date(today + 'T00:00:00');
  for (let i = 0; i <= sorted.length; i++) {
    const checkDate = new Date(current);
    checkDate.setDate(checkDate.getDate() - i);
    const checkStr = checkDate.toISOString().split('T')[0];
    if (sorted.includes(checkStr)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function AddHabitButton() {
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('⭐');

  const handleAdd = async () => {
    if (!title.trim()) return;
    await db.habits.add({
      title: title.trim(),
      icon,
      completedDates: [],
      createdAt: new Date().toISOString(),
    });
    setTitle('');
    setIcon('⭐');
    setShow(false);
  };

  if (!show) {
    return (
      <button className="section-header__action" onClick={() => setShow(true)}>
        + Add
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <select
        value={icon}
        onChange={(e) => setIcon(e.target.value)}
        style={{ width: 50, padding: '6px', fontSize: '1rem', textAlign: 'center' }}
      >
        {['⭐', '💊', '📖', '🧘', '💪', '🏃', '💤', '🥗', '🎯'].map((e) => (
          <option key={e} value={e}>{e}</option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Habit name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ padding: '6px 10px', fontSize: '0.8125rem', width: 100 }}
        autoFocus
      />
      <button className="btn btn-primary btn-sm" onClick={handleAdd}>✓</button>
      <button className="btn btn-ghost btn-sm" onClick={() => setShow(false)}>✕</button>
    </div>
  );
}
