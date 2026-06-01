import { useState } from 'react';
import { db } from '../db/database';
import {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  calculateMacros,
} from '../utils/helpers';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  { icon: '👋', title: 'Welcome to FitTrack', desc: 'Let\'s set up your personal fitness profile to help you reach your goals.' },
  { icon: '🎯', title: 'What\'s your goal?', desc: 'We\'ll tailor your daily targets based on your fitness goal.' },
  { icon: '📏', title: 'Your Details', desc: 'Help us calculate your ideal intake.' },
  { icon: '🏃', title: 'Activity Level', desc: 'How active are you on a typical day?' },
  { icon: '✨', title: 'You\'re all set!', desc: 'Your personalized targets are ready.' },
];

const GOALS = [
  { value: 'lose', icon: '🔥', label: 'Lose Weight', desc: 'Cut body fat while preserving muscle' },
  { value: 'maintain', icon: '⚖️', label: 'Maintain Weight', desc: 'Stay at your current weight' },
  { value: 'gain', icon: '💪', label: 'Build Muscle', desc: 'Gain lean mass and strength' },
] as const;

const ACTIVITY_LEVELS = [
  { value: 'sedentary', icon: '🪑', label: 'Sedentary', desc: 'Little to no exercise' },
  { value: 'light', icon: '🚶', label: 'Lightly Active', desc: 'Exercise 1-3 days/week' },
  { value: 'moderate', icon: '🏃', label: 'Moderately Active', desc: 'Exercise 3-5 days/week' },
  { value: 'active', icon: '🏋️', label: 'Very Active', desc: 'Exercise 6-7 days/week' },
  { value: 'very_active', icon: '⚡', label: 'Extremely Active', desc: 'Intense training daily' },
] as const;

export default function OnboardingScreen({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState(25);
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(70);
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'>('moderate');

  const bmr = calculateBMR(gender, weightKg, heightCm, age);
  const tdee = calculateTDEE(bmr, activityLevel);
  const targetCalories = calculateTargetCalories(tdee, goal);
  const macros = calculateMacros(targetCalories, goal);

  const handleFinish = async () => {
    await db.userProfiles.add({
      name: name || 'User',
      email: '',
      heightCm,
      weightKg,
      age,
      gender,
      activityLevel,
      goal,
      calorieTarget: targetCalories,
      proteinTarget: macros.protein,
      carbTarget: macros.carbs,
      fatTarget: macros.fats,
      waterTarget: 2500,
      createdAt: new Date().toISOString(),
    });
    onComplete();
  };

  const canNext = () => {
    if (step === 0) return name.trim().length > 0;
    return true;
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="animate-in">
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group mt-md">
              <label className="form-label">Gender</label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    className={`chip ${gender === g ? 'active' : ''}`}
                    onClick={() => setGender(g)}
                    style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                  >
                    {g === 'male' ? '♂️ Male' : '♀️ Female'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="onboarding__options animate-in">
            {GOALS.map((g) => (
              <button
                key={g.value}
                className={`onboarding__option ${goal === g.value ? 'selected' : ''}`}
                onClick={() => setGoal(g.value)}
              >
                <span className="onboarding__option-icon">{g.icon}</span>
                <div>
                  <div className="onboarding__option-text">{g.label}</div>
                  <div className="onboarding__option-desc">{g.desc}</div>
                </div>
              </button>
            ))}
          </div>
        );

      case 2:
        return (
          <div className="animate-in">
            <div className="form-group">
              <label className="form-label">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                min={10}
                max={100}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Height (cm)</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  min={100}
                  max={250}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Weight (kg)</label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  min={30}
                  max={300}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="onboarding__options animate-in">
            {ACTIVITY_LEVELS.map((a) => (
              <button
                key={a.value}
                className={`onboarding__option ${activityLevel === a.value ? 'selected' : ''}`}
                onClick={() => setActivityLevel(a.value)}
              >
                <span className="onboarding__option-icon">{a.icon}</span>
                <div>
                  <div className="onboarding__option-text">{a.label}</div>
                  <div className="onboarding__option-desc">{a.desc}</div>
                </div>
              </button>
            ))}
          </div>
        );

      case 4:
        return (
          <div className="animate-in">
            <div className="glass-card glass-card--accent mb-lg">
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
                <div className="text-caption mb-sm">Daily Calorie Target</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 800, color: 'var(--accent)' }}>
                  {targetCalories}
                </div>
                <div className="text-muted">kcal per day</div>
              </div>
              <div className="divider" />
              <div className="stats-grid--3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                <div className="profile-stat">
                  <div className="profile-stat__value" style={{ color: 'var(--protein-color)' }}>{macros.protein}g</div>
                  <div className="profile-stat__label">Protein</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat__value" style={{ color: 'var(--carbs-color)' }}>{macros.carbs}g</div>
                  <div className="profile-stat__label">Carbs</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat__value" style={{ color: 'var(--fats-color)' }}>{macros.fats}g</div>
                  <div className="profile-stat__label">Fats</div>
                </div>
              </div>
            </div>
            <p className="text-secondary text-center" style={{ fontSize: '0.875rem' }}>
              Based on your BMR of {Math.round(bmr)} kcal and TDEE of {tdee} kcal
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding__progress">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`onboarding__step ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}
          />
        ))}
      </div>

      <div className="onboarding__content">
        <div className="onboarding__icon">{STEPS[step].icon}</div>
        <h1 className="onboarding__title">{STEPS[step].title}</h1>
        <p className="onboarding__description">{STEPS[step].desc}</p>

        {renderStepContent()}

        <div className="onboarding__actions">
          {step > 0 && (
            <button className="btn btn-secondary flex-1" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              className="btn btn-primary flex-1"
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              style={{ opacity: canNext() ? 1 : 0.5 }}
            >
              Continue
            </button>
          ) : (
            <button className="btn btn-primary flex-1" onClick={handleFinish}>
              🚀 Let's Go!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
