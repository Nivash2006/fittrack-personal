import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { getLast7Days, getDayName, calculateBMR, calculateTDEE, getTodayStr } from '../utils/helpers';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine, Legend } from 'recharts';

export default function DeficitScreen() {
  const profile = useLiveQuery(() => db.userProfiles.toCollection().first());
  const allMeals = useLiveQuery(() => db.meals.toArray());
  const allWorkouts = useLiveQuery(() => db.workouts.toArray());
  const allSteps = useLiveQuery(() => db.stepLogs.toArray());

  const today = getTodayStr();
  const last7 = getLast7Days();

  // Custom local override for calculator
  const [weight, setWeight] = useState<number>(profile?.weightKg ?? 70);
  const [height, setHeight] = useState<number>(profile?.heightCm ?? 172);
  const [age, setAge] = useState<number>(profile?.age ?? 28);
  const [gender, setGender] = useState<'male' | 'female'>(profile?.gender ?? 'male');
  const [activityLevel, setActivityLevel] = useState<string>(profile?.activityLevel ?? 'moderate');

  // Sync state with profile when it loads
  useMemo(() => {
    if (profile) {
      setWeight(profile.weightKg);
      setHeight(profile.heightCm);
      setAge(profile.age);
      setGender(profile.gender);
      setActivityLevel(profile.activityLevel);
    }
  }, [profile]);

  // Calculations
  const bmr = useMemo(() => {
    return Math.round(calculateBMR(gender, weight, height, age));
  }, [weight, height, age, gender]);

  const tdee = useMemo(() => {
    return Math.round(calculateTDEE(bmr, activityLevel as any));
  }, [bmr, activityLevel]);

  // Map out 7 days of calorie deficit data
  const deficitData = useMemo(() => {
    if (!allMeals || !allWorkouts || !allSteps) return [];

    return last7.map((date) => {
      // 1. Calories consumed
      const dayMeals = allMeals.filter((m) => m.date === date);
      const consumed = dayMeals.reduce((sum, m) => sum + m.calories, 0);

      // 2. Active calories burned through workouts
      const dayWorkouts = allWorkouts.filter((w) => w.date === date);
      const workoutBurn = dayWorkouts.reduce((sum, w) => {
        // Estimate: 4.5 kcal per set, cardio = ~9 kcal per min
        const setsBurn = w.sets.reduce((s) => s + 4.5, 0);
        const durationBurn = (w.duration ?? 0) * 9;
        return sum + setsBurn + durationBurn;
      }, 0);

      // 3. Active calories burned through steps
      const dayStepsLog = allSteps.find((s) => s.date === date);
      const stepsCount = dayStepsLog?.count ?? 0;
      const stepsBurn = stepsCount * 0.04; // 0.04 kcal per step

      const totalActiveBurn = Math.round(workoutBurn + stepsBurn);
      const totalExpenditure = Math.round(tdee + totalActiveBurn);
      const netDeficit = totalExpenditure - consumed;

      return {
        date,
        day: getDayName(date),
        consumed,
        expenditure: totalExpenditure,
        activeBurn: totalActiveBurn,
        deficit: netDeficit,
        isDeficit: netDeficit > 0,
      };
    });
  }, [allMeals, allWorkouts, allSteps, last7, tdee]);

  const todayData = useMemo(() => {
    return deficitData.find((d) => d.date === today) || {
      consumed: 0,
      expenditure: tdee,
      activeBurn: 0,
      deficit: tdee,
    };
  }, [deficitData, today, tdee]);

  const averageDeficit = useMemo(() => {
    if (deficitData.length === 0) return 0;
    const total = deficitData.reduce((sum, d) => sum + d.deficit, 0);
    return Math.round(total / deficitData.length);
  }, [deficitData]);

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
        <h1 className="page-header__title">Calorie Deficit</h1>
      </div>

      {/* Today Deficit Overview */}
      <div className="glass-card mb-md text-center" style={{ borderLeft: '4px solid var(--accent)' }}>
        <div className="text-caption">Today's Calorie Balance</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', margin: 'var(--space-md) 0' }}>
          <div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>Consumed</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent3)' }}>{todayData.consumed}</div>
            <div className="text-small text-muted">kcal</div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--text-muted)' }}>—</div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>Total Burned</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent2)' }}>{todayData.expenditure}</div>
            <div className="text-small text-muted">kcal</div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--text-muted)' }}>=</div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>Net Deficit</div>
            <div style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: todayData.deficit >= 500 ? 'var(--accent)' : todayData.deficit > 0 ? '#4d8dff' : 'var(--danger)',
              fontFamily: 'var(--font-display)'
            }}>
              {todayData.deficit}
            </div>
            <div className="text-small text-muted">kcal</div>
          </div>
        </div>
        <div className="text-small text-muted">
          {todayData.deficit >= 500
            ? '🔥 Excellent. You have hit a highly sustainable fat-loss deficit.'
            : todayData.deficit > 0
              ? '👍 Positive balance. Increase active burn or adjust meals to reach 500 kcal deficit.'
              : '⚠️ Surplus. You are consuming more than your expenditure.'}
        </div>
      </div>

      {/* 7-Day Deficit Chart */}
      <div className="glass-card mb-md">
        <div className="section-header">
          <span className="section-header__title">📉 7-Day Deficit Trend</span>
        </div>
        <div className="chart-container" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deficitData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fill: '#9a9ab0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9a9ab0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '0.75rem', color: '#9a9ab0' }} />
              <Bar name="Burned (TDEE + Active)" dataKey="expenditure" fill="#4d8dff" radius={[4, 4, 0, 0]} opacity={0.65} />
              <Bar name="Consumed" dataKey="consumed" fill="#ff4d6a" radius={[4, 4, 0, 0]} opacity={0.8} />
              <ReferenceLine y={0} stroke="#444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center text-small text-muted mt-sm">
          Average Deficit: <strong style={{ color: 'var(--accent)' }}>{averageDeficit} kcal / day</strong>
        </div>
      </div>

      {/* Interactive TDEE & Deficit Calculator */}
      <div className="glass-card mb-md">
        <div className="section-header">
          <span className="section-header__title">🧮 Calorie Deficit Calculator</span>
        </div>
        <div className="form-grid mb-md">
          <div>
            <label className="form-label">Weight (kg)</label>
            <input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
          </div>
          <div>
            <label className="form-label">Height (cm)</label>
            <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
          </div>
          <div>
            <label className="form-label">Age (years)</label>
            <input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} />
          </div>
          <div>
            <label className="form-label">Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value as any)}>
              <option value="male">Male (+5)</option>
              <option value="female">Female (-161)</option>
            </select>
          </div>
        </div>

        <div className="form-group mb-md">
          <label className="form-label">Activity Multiplier</label>
          <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)}>
            <option value="sedentary">Sedentary (BMR × 1.2)</option>
            <option value="light">Lightly Active (BMR × 1.375)</option>
            <option value="moderate">Moderately Active (BMR × 1.55)</option>
            <option value="active">Active (BMR × 1.725)</option>
            <option value="very_active">Very Active (BMR × 1.9)</option>
          </select>
        </div>

        <div className="stats-grid mt-md" style={{ background: 'rgba(255,255,255,0.02)', padding: 'var(--space-md)', borderRadius: 8 }}>
          <div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>BMR (Base Metabolism)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{bmr} kcal</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>TDEE (Maintenance)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent2)' }}>{tdee} kcal</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>Recommended Deficit Intake</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>{tdee - 500} kcal</div>
          </div>
        </div>
      </div>

      {/* Deficit Concept & Framework Explanation */}
      <div className="glass-card mb-md">
        <div className="section-header">
          <span className="section-header__title">📖 What is a Calorie Deficit?</span>
        </div>
        <div style={{ fontSize: '0.875rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <p>
            A <strong>calorie deficit</strong> occurs when you consume fewer calories than your body burns to sustain its functions and physical activity.
            When this happens, your body is forced to mobilize energy from stored tissues—primarily fat stores—resulting in predictable and consistent weight loss.
          </p>
          <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 'var(--space-md)' }}>
            <strong>Why it works:</strong> Thermodynamics dictates that energy cannot be created or destroyed.
            A deficit of 500 kcal per day translates to 3,500 kcal per week, which approximates to a safe and highly sustainable loss of ~0.5 kg of body fat weekly.
          </div>
        </div>
      </div>

      {/* Practical Deficit Framework */}
      <div className="glass-card mb-md">
        <div className="section-header">
          <span className="section-header__title">📋 5-Step Calorie Deficit Framework</span>
        </div>
        <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
          <ol style={{ paddingLeft: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <li>
              <strong>BMR Calculation</strong>: Calculate your Basal Metabolic Rate using the Mifflin-St Jeor formula (done automatically in the calculator above).
            </li>
            <li>
              <strong>TDEE Assessment</strong>: Multiply BMR by your physical activity level factor to establish your calorie maintenance baseline.
            </li>
            <li>
              <strong>Deficit Calibration</strong>: Subtract 300 to 500 kcal from TDEE. Do not go below BMR or 1,200 kcal/day (female) or 1,500 kcal/day (male) without medical advice.
            </li>
            <li>
              <strong>Macro Tuning</strong>: Aim for 25–35% protein, 40–50% carbohydrates, and 20–30% dietary fats. High protein preserves lean muscle tissue during calorie restriction.
            </li>
            <li>
              <strong>Tracking Balance</strong>: Compare your calorie intake (meals) against output (TDEE + workouts/steps) daily using the trend chart above.
            </li>
          </ol>
        </div>
      </div>

      {/* Sample Deficit Day Plan */}
      <div className="glass-card mb-md">
        <div className="section-header">
          <span className="section-header__title">🥗 Sample Deficit Meal Plan (~1,500 kcal Target)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="meal-card">
            <div className="meal-card__info">
              <div className="meal-card__name">🍳 Breakfast (320 kcal)</div>
              <div className="meal-card__meta">2 Boiled Eggs + 1 slice whole wheat toast + cucumber salad</div>
            </div>
            <div className="meal-card__calories" style={{ color: 'var(--accent)' }}>320 kcal</div>
          </div>
          <div className="meal-card">
            <div className="meal-card__info">
              <div className="meal-card__name">🍎 Snack 1 (110 kcal)</div>
              <div className="meal-card__meta">1 Medium Apple + 10 almonds</div>
            </div>
            <div className="meal-card__calories" style={{ color: 'var(--accent)' }}>110 kcal</div>
          </div>
          <div className="meal-card">
            <div className="meal-card__info">
              <div className="meal-card__name">🍛 Lunch (480 kcal)</div>
              <div className="meal-card__meta">150g Grilled Chicken Breast + 120g Brown Rice + steamed vegetables</div>
            </div>
            <div className="meal-card__calories" style={{ color: 'var(--accent)' }}>480 kcal</div>
          </div>
          <div className="meal-card">
            <div className="meal-card__info">
              <div className="meal-card__name">🥤 Snack 2 (140 kcal)</div>
              <div className="meal-card__meta">150g Low-fat Curd / Greek yogurt</div>
            </div>
            <div className="meal-card__calories" style={{ color: 'var(--accent)' }}>140 kcal</div>
          </div>
          <div className="meal-card">
            <div className="meal-card__info">
              <div className="meal-card__name">🍲 Dinner (450 kcal)</div>
              <div className="meal-card__meta">120g Pan-seared Paneer or Soya chunks curry + 2 Chapatis + Rasam</div>
            </div>
            <div className="meal-card__calories" style={{ color: 'var(--accent)' }}>450 kcal</div>
          </div>
        </div>
      </div>

      {/* Safety Notes & Expectations */}
      <div className="glass-card mb-lg">
        <div className="section-header">
          <span className="section-header__title">⚠️ Safety Notes & Timeframes</span>
        </div>
        <div style={{ fontSize: '0.875rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <p>
            <strong>Expectations:</strong> Safe, healthy fat loss averages 0.25 to 0.75 kg per week.
            Rapid drops in the first 1–2 weeks are normal and typically represent water weight depleting with glycogen.
          </p>
          <p>
            <strong>How to adjust when progress stalls:</strong> If weight plateau lasts longer than 2 weeks:
            1. Re-calculate BMR and TDEE using your new lower weight.
            2. Double-check portion sizes (use a food scale to verify weight).
            3. Increase non-exercise activity (NEAT), such as steps, rather than cutting calories further.
          </p>
          <div style={{ padding: 'var(--space-sm)', background: 'rgba(255, 77, 106, 0.05)', borderRadius: 6, border: '1px solid rgba(255, 77, 106, 0.15)', color: 'var(--danger)' }}>
            <strong>Caution:</strong> Avoid crash dieting. Consuming fewer than 1,200 kcal/day can trigger fatigue, metabolic slowing, nutritional deficiencies, and lean muscle degradation.
          </div>
        </div>
      </div>
    </div>
  );
}
