import { useState, useEffect } from 'react';
import { syncEngine } from '../db/syncEngine';
import {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  calculateMacros,
} from '../utils/helpers';
import { supabase } from '../db/supabaseClient';

// ─── Types & Constants ────────────────────────────────────────────────────────

interface OnboardingProps {
  onComplete: () => void;
}

type Goal = 'lose' | 'maintain' | 'gain';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type Gender = 'male' | 'female';

interface WizardState {
  step: number;
  name: string;
  gender: Gender;
  age: string;
  heightCm: string;
  weightKg: string;
  goal: Goal;
  activityLevel: ActivityLevel;
  adjustedCalories: number | null;
}

const LS_KEY = 'fittrack_onboarding_progress';

const GOALS = [
  { value: 'lose' as Goal, icon: '🔥', label: 'Lose Weight', desc: 'Cut body fat while preserving muscle', color: 'var(--danger)' },
  { value: 'maintain' as Goal, icon: '⚖️', label: 'Maintain Weight', desc: 'Stay at your current weight', color: 'var(--accent2)' },
  { value: 'gain' as Goal, icon: '💪', label: 'Build Muscle', desc: 'Gain lean mass and strength', color: 'var(--accent)' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary' as ActivityLevel, icon: '🪑', label: 'Sedentary', desc: 'Desk job, little movement' },
  { value: 'light' as ActivityLevel, icon: '🚶', label: 'Lightly Active', desc: 'Exercise 1–3 days/week' },
  { value: 'moderate' as ActivityLevel, icon: '🏃', label: 'Moderately Active', desc: 'Exercise 3–5 days/week' },
  { value: 'active' as ActivityLevel, icon: '🏋️', label: 'Very Active', desc: 'Exercise 6–7 days/week' },
  { value: 'very_active' as ActivityLevel, icon: '⚡', label: 'Extremely Active', desc: 'Intense daily training or physical job' },
];

const TOTAL_STEPS = 4;

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep(step: number, state: WizardState): string | null {
  switch (step) {
    case 0:
      if (!state.name.trim() || state.name.trim().length < 2) return 'Please enter your name (at least 2 characters)';
      return null;
    case 1: {
      const age = Number(state.age);
      const height = Number(state.heightCm);
      const weight = Number(state.weightKg);
      if (!state.age || isNaN(age) || age < 10 || age > 100) return 'Please enter a valid age (10–100 years)';
      if (!state.heightCm || isNaN(height) || height < 100 || height > 250) return 'Please enter a valid height (100–250 cm)';
      if (!state.weightKg || isNaN(weight) || weight < 25 || weight > 350) return 'Please enter a valid weight (25–350 kg)';
      return null;
    }
    case 2:
      return null; // Goal always has a default
    case 3:
      return null; // Activity always has a default
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingScreen({ onComplete }: OnboardingProps) {
  // Load persisted wizard state
  const [state, setState] = useState<WizardState>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      step: 0,
      name: '',
      gender: 'male',
      age: '25',
      heightCm: '170',
      weightKg: '70',
      goal: 'maintain',
      activityLevel: 'moderate',
      adjustedCalories: null,
    };
  });

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  // Prefill name from Supabase auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userEmail = data?.user?.email || '';
      const userName = data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.name || '';
      if (userName && !state.name) {
        updateState({ name: userName });
      }
      if (userEmail && !state.name && !userName) {
        updateState({ name: userEmail.split('@')[0] });
      }
    });
  }, []);

  // Persist state to localStorage on every change
  const updateState = (patch: Partial<WizardState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    setError(null);
  };

  // ── Computed values ─────────────────────────────────────────────────────

  const age = Number(state.age) || 25;
  const heightCm = Number(state.heightCm) || 170;
  const weightKg = Number(state.weightKg) || 70;
  const bmr = Math.round(calculateBMR(state.gender, weightKg, heightCm, age));
  const tdee = Math.round(calculateTDEE(bmr, state.activityLevel));
  const autoCalories = calculateTargetCalories(tdee, state.goal);
  const targetCalories = state.adjustedCalories ?? autoCalories;
  const macros = calculateMacros(targetCalories, state.goal);

  // ── Navigation ──────────────────────────────────────────────────────────

  const goNext = () => {
    const validationError = validateStep(state.step, state);
    if (validationError) { setError(validationError); return; }
    setError(null);
    setDirection('forward');
    updateState({ step: state.step + 1, adjustedCalories: state.step === 3 ? autoCalories : state.adjustedCalories });
  };

  const goBack = () => {
    setError(null);
    setDirection('back');
    updateState({ step: state.step - 1 });
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      await syncEngine.saveProfile({
        name: state.name.trim(),
        email: data?.user?.email || '',
        heightCm,
        weightKg,
        age,
        gender: state.gender,
        activityLevel: state.activityLevel,
        goal: state.goal,
        calorieTarget: targetCalories,
        proteinTarget: macros.protein,
        carbTarget: macros.carbs,
        fatTarget: macros.fats,
        waterTarget: 2500,
        createdAt: new Date().toISOString(),
      });
      localStorage.removeItem(LS_KEY);
      onComplete();
    } catch (err) {
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const progressPercent = ((state.step) / TOTAL_STEPS) * 100;

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      overflowX: 'hidden',
    }}>
      {/* Progress Bar */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(10,10,15,0.9)',
        backdropFilter: 'blur(20px)',
        padding: 'var(--space-md) var(--space-lg)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>
            🏋️ FitTrack Setup
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Step {state.step + 1} of {TOTAL_STEPS + 1}
          </div>
        </div>
        <div style={{ height: '4px', background: 'var(--bg-glass-strong)', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
            borderRadius: '99px',
            transition: 'width 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          }} />
        </div>
      </div>

      {/* Step Content */}
      <div style={{ flex: 1, padding: 'var(--space-lg)', maxWidth: '480px', width: '100%', margin: '0 auto' }}>
        <StepContent
          step={state.step}
          state={state}
          onUpdate={updateState}
          bmr={bmr}
          tdee={tdee}
          targetCalories={targetCalories}
          macros={macros}
          direction={direction}
        />

        {/* Validation Error */}
        {error && (
          <div style={{
            marginTop: 'var(--space-md)',
            padding: '12px 16px',
            background: 'rgba(255,77,106,0.1)',
            border: '1px solid rgba(255,77,106,0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '0.875rem',
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        padding: 'var(--space-md) var(--space-lg)',
        background: 'rgba(10,10,15,0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: 'var(--space-sm)',
      }}>
        {state.step > 0 && (
          <button
            className="btn btn-secondary"
            onClick={goBack}
            style={{ flex: '0 0 auto', padding: '14px 20px' }}
            disabled={saving}
          >
            ← Back
          </button>
        )}
        {state.step < TOTAL_STEPS ? (
          <button
            className="btn btn-primary btn-block"
            onClick={goNext}
            style={{ flex: 1, padding: '14px', fontSize: '1rem', fontWeight: 700 }}
          >
            Continue →
          </button>
        ) : (
          <button
            className="btn btn-primary btn-block"
            onClick={handleFinish}
            disabled={saving}
            style={{ flex: 1, padding: '14px', fontSize: '1rem', fontWeight: 700 }}
          >
            {saving ? '⏳ Saving...' : '🚀 Start My Journey!'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step Renderer ────────────────────────────────────────────────────────────

function StepContent({ step, state, onUpdate, bmr, tdee, targetCalories, macros, direction }: {
  step: number;
  state: WizardState;
  onUpdate: (patch: Partial<WizardState>) => void;
  bmr: number;
  tdee: number;
  targetCalories: number;
  macros: { protein: number; carbs: number; fats: number };
  direction: 'forward' | 'back';
}) {
  const animClass = direction === 'forward' ? 'animate-in' : 'animate-in';

  switch (step) {
    // ── Step 0: Identity ────────────────────────────────────────────────────
    case 0:
      return (
        <div className={animClass}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
            <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)', lineHeight: 1 }}>👋</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
              Welcome to FitTrack
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
              Your personal health intelligence platform. Let's set up your profile in 4 quick steps.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input
              type="text"
              placeholder="e.g. Arjun Kumar"
              value={state.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              autoFocus
              maxLength={50}
            />
          </div>

          <div className="form-group mt-md">
            <label className="form-label">Gender</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              {(['male', 'female'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => onUpdate({ gender: g })}
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${state.gender === g ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: state.gender === g ? 'var(--accent-dim)' : 'var(--bg-glass)',
                    color: state.gender === g ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ fontSize: '2rem' }}>{g === 'male' ? '♂' : '♀'}</span>
                  <span style={{ fontSize: '0.875rem' }}>{g === 'male' ? 'Male' : 'Female'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );

    // ── Step 1: Biometrics ──────────────────────────────────────────────────
    case 1:
      return (
        <div className={animClass}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
            <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)', lineHeight: 1 }}>📏</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
              Your Biometrics
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
              We use these to calculate your personal calorie and macro targets.
            </p>
          </div>

          <div className="glass-card mb-md" style={{ padding: 'var(--space-lg)' }}>
            <div className="form-group">
              <label className="form-label">Age (years)</label>
              <input
                type="number"
                value={state.age}
                onChange={(e) => onUpdate({ age: e.target.value })}
                min={10}
                max={100}
                placeholder="25"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Height (cm)</label>
                <input
                  type="number"
                  value={state.heightCm}
                  onChange={(e) => onUpdate({ heightCm: e.target.value })}
                  min={100}
                  max={250}
                  placeholder="170"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Weight (kg)</label>
                <input
                  type="number"
                  value={state.weightKg}
                  onChange={(e) => onUpdate({ weightKg: e.target.value })}
                  min={25}
                  max={350}
                  placeholder="70"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 16px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            🔒 Your data is stored locally and synced privately to your account only.
          </div>
        </div>
      );

    // ── Step 2: Goal ────────────────────────────────────────────────────────
    case 2:
      return (
        <div className={animClass}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
            <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)', lineHeight: 1 }}>🎯</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
              What's Your Goal?
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
              Your goal shapes your calorie target and macro split.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {GOALS.map((g) => (
              <button
                key={g.value}
                onClick={() => onUpdate({ goal: g.value, adjustedCalories: null })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  padding: '20px var(--space-lg)',
                  borderRadius: 'var(--radius-lg)',
                  border: `2px solid ${state.goal === g.value ? g.color : 'var(--border-subtle)'}`,
                  background: state.goal === g.value ? `${g.color}15` : 'var(--bg-glass)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 200ms ease',
                  boxShadow: state.goal === g.value ? `0 0 20px ${g.color}30` : 'none',
                }}
              >
                <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{g.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: state.goal === g.value ? g.color : 'var(--text-primary)' }}>
                    {g.label}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{g.desc}</div>
                </div>
                {state.goal === g.value && (
                  <div style={{ marginLeft: 'auto', color: g.color, fontWeight: 700 }}>✓</div>
                )}
              </button>
            ))}
          </div>
        </div>
      );

    // ── Step 3: Activity Level ──────────────────────────────────────────────
    case 3:
      return (
        <div className={animClass}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
            <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)', lineHeight: 1 }}>🏃</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
              Activity Level
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
              How active are you on a typical week?
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {ACTIVITY_LEVELS.map((a) => (
              <button
                key={a.value}
                onClick={() => onUpdate({ activityLevel: a.value, adjustedCalories: null })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  padding: '16px var(--space-lg)',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${state.activityLevel === a.value ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  background: state.activityLevel === a.value ? 'var(--accent-dim)' : 'var(--bg-glass)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 200ms ease',
                }}
              >
                <span style={{ fontSize: '1.75rem', lineHeight: 1, minWidth: '2rem', textAlign: 'center' }}>{a.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: state.activityLevel === a.value ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {a.label}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{a.desc}</div>
                </div>
                {state.activityLevel === a.value && (
                  <div style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 700 }}>✓</div>
                )}
              </button>
            ))}
          </div>
        </div>
      );

    // ── Step 4: Summary & Confirm ───────────────────────────────────────────
    case 4:
      return (
        <div className={animClass}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
            <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)', lineHeight: 1 }}>✨</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
              Your Targets Are Ready
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
              Here's what we calculated for <strong style={{ color: 'var(--text-primary)' }}>{state.name}</strong>
            </p>
          </div>

          {/* Calorie Target */}
          <div className="glass-card mb-md" style={{
            textAlign: 'center',
            padding: 'var(--space-xl)',
            border: '1px solid var(--accent)',
            boxShadow: '0 0 30px var(--accent-glow)',
          }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>Daily Calorie Target</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
              {targetCalories}
            </div>
            <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>kcal per day</div>

            {/* Editable slider */}
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Adjust target: {targetCalories} kcal
              </label>
              <input
                type="range"
                min={Math.max(1000, tdee - 800)}
                max={tdee + 600}
                step={50}
                value={targetCalories}
                onChange={(e) => onUpdate({ adjustedCalories: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                <span>{Math.max(1000, tdee - 800)} kcal</span>
                <span>TDEE: {tdee}</span>
                <span>{tdee + 600} kcal</span>
              </div>
            </div>
          </div>

          {/* Macros */}
          <div className="glass-card mb-md">
            <div className="section-header">
              <span className="section-header__title">Macro Targets</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: '#4d8dff' }}>{macros.protein}g</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Protein</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: '#ffb347' }}>{macros.carbs}g</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Carbs</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: '#ff4d6a' }}>{macros.fats}g</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fats</div>
              </div>
            </div>
          </div>

          {/* BMR Info */}
          <div className="glass-card" style={{ fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Basal Metabolic Rate (BMR)</span>
              <span style={{ fontWeight: 700 }}>{bmr} kcal</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Daily Energy (TDEE)</span>
              <span style={{ fontWeight: 700 }}>{tdee} kcal</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Goal</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                {state.goal === 'lose' ? '🔥 Lose Weight' : state.goal === 'gain' ? '💪 Build Muscle' : '⚖️ Maintain'}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-md)', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
            You can change any of these targets from Profile Settings at any time.
          </div>
        </div>
      );

    default:
      return null;
  }
}
