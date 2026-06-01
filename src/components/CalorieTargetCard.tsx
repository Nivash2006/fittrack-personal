import { useState, useEffect } from 'react';
import { db } from '../db/database';
import { ShieldAlert, Activity, FileText, Check } from 'lucide-react';

interface CalorieTargetCardProps {
  onNoteCreated?: () => void;
}

export default function CalorieTargetCard({ onNoteCreated }: CalorieTargetCardProps) {
  // Local state for calculation parameters, pre-populated with safe defaults
  const [age, setAge] = useState(28);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [weightKg, setWeightKg] = useState(75);
  const [heightCm, setHeightCm] = useState(175);
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'>('moderate');
  const [deficitPercent, setDeficitPercent] = useState(15);
  const [isGenerated, setIsGenerated] = useState(false);

  // Load profile from Dexie.js to customize calculation
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profiles = await db.userProfiles.toArray();
        if (profiles.length > 0) {
          const user = profiles[0];
          setAge(user.age);
          setGender(user.gender);
          setWeightKg(user.weightKg);
          setHeightCm(user.heightCm);
          setActivityLevel(user.activityLevel);
          // Set safe deficit from goal if present
          if (user.goal === 'lose') {
            setDeficitPercent(15);
          } else {
            setDeficitPercent(10);
          }
        }
      } catch (err) {
        console.error('Error loading user profile:', err);
      }
    };
    loadProfile();
  }, []);

  // Mifflin-St Jeor BMR calculation
  const genderOffset = gender === 'male' ? 5 : -161;
  const bmr = Math.round((10 * weightKg) + (6.25 * heightCm) - (5 * age) + genderOffset);

  // Activity Multipliers
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };

  const tdee = Math.round(bmr * activityMultipliers[activityLevel]);
  
  // Safe bounded calorie deficit range (10% to 20%)
  const boundedDeficit = Math.max(10, Math.min(20, deficitPercent));
  const deficitKcal = Math.round(tdee * (boundedDeficit / 100));
  const safeTarget = Math.max(1200, Math.round(tdee - deficitKcal)); // 1200 Kcal safety floor

  // Macro target guidelines:
  // Protein: 2.0g per kg of bodyweight for muscle maintenance
  const proteinG = Math.round(weightKg * 2.0);
  const proteinKcal = proteinG * 4;
  // Fats: 25% of safeTarget calories
  const fatsG = Math.round((safeTarget * 0.25) / 9);
  const fatsKcal = fatsG * 9;
  // Carbs: rest of target calories
  const carbsKcal = Math.max(0, safeTarget - (proteinKcal + fatsKcal));
  const carbsG = Math.round(carbsKcal / 4);

  const handleGenerateNote = async () => {
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const todayISO = new Date().toISOString().split('T')[0];

    const noteTitle = `Health Log: ${dateStr}`;
    const noteContent = `# Daily Health & Deficit Log — ${dateStr}

## 📊 Metabolic Profile
* **Basal Metabolic Rate (BMR):** ${bmr} kcal
* **Total Daily Energy Expenditure (TDEE):** ${tdee} kcal
* **Applied Caloric Deficit:** ${boundedDeficit}% (-${deficitKcal} kcal)
* **Daily Calorie Target:** **${safeTarget} kcal**

## 🍗 Macronutrient Allocation Target
* **Protein:** ${proteinG}g (approx. 2.0g per kg of bodyweight to safeguard muscle)
* **Carbohydrates:** ${carbsG}g
* **Fats:** ${fatsG}g

## ⏱️ Today's Fasting & Activities
* *Configured fasting targets, hydration goals, and workout recovery reviews can be typed below:*
* **Fasting Complete:** Yes / No
* **Hydration (ml):** 
* **Workout Checklist:** 

## ✍️ Self-Reflection & Energy Notes
*Type here to record details on physical fatigue, sleep length, mood, and mental stamina...*
`;

    try {
      const nowISO = new Date().toISOString();
      await db.notes.add({
        title: noteTitle,
        content: noteContent,
        tags: ['health-log', 'metabolic', todayISO],
        notebook: 'Health Logs',
        createdAt: nowISO,
        updatedAt: nowISO
      });

      setIsGenerated(true);
      setTimeout(() => setIsGenerated(false), 2000);
      
      if (onNoteCreated) {
        onNoteCreated();
      }
    } catch (err) {
      console.error('Failed to auto-generate log note:', err);
    }
  };

  return (
    <div className="glass-card calorie-target-card" style={{ marginBottom: 'var(--space-lg)' }}>
      <div className="section-header" style={{ marginBottom: 'var(--space-md)' }}>
        <h3 className="section-header__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} color="var(--accent)" />
          Safe Deficit & Macros Calculator
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Gender
            </label>
            <select value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female')}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Age (years)
            </label>
            <input type="number" value={age} onChange={(e) => setAge(Math.max(1, Number(e.target.value)))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Weight (kg)
            </label>
            <input type="number" value={weightKg} onChange={(e) => setWeightKg(Math.max(1, Number(e.target.value)))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Height (cm)
            </label>
            <input type="number" value={heightCm} onChange={(e) => setHeightCm(Math.max(1, Number(e.target.value)))} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Daily Physical Activity Level
          </label>
          <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as any)}>
            <option value="sedentary">Sedentary (desk work, minimal activity)</option>
            <option value="light">Lightly Active (light exercise 1-3 days/wk)</option>
            <option value="moderate">Moderately Active (moderate sports 3-5 days/wk)</option>
            <option value="active">Very Active (intense training 6-7 days/wk)</option>
            <option value="very_active">Highly Active (heavy physical work or dual sports)</option>
          </select>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Target Deficit Percentage
            </label>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent)' }}>
              {deficitPercent}%
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="20"
            step="1"
            value={deficitPercent}
            onChange={(e) => setDeficitPercent(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '6px', background: 'var(--bg-glass-strong)', borderRadius: '4px' }}
          />
        </div>

        {/* Calculations Dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', padding: '12px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>TDEE (Burn rate)</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{tdee} kcal</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 600 }}>Safe Deficit Target</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>{safeTarget} kcal</span>
          </div>
        </div>

        {/* Protein preservation advice */}
        <div className="guidance-tip" style={{ display: 'flex', gap: '8px', padding: '12px', background: 'rgba(0, 230, 138, 0.04)', border: '1px solid rgba(0, 230, 138, 0.12)', borderRadius: 'var(--radius-md)' }}>
          <ShieldAlert size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
            In a <strong>{deficitPercent}%</strong> deficit, prioritizing <strong>{proteinG}g</strong> of protein safeguards skeletal muscle mass. Target a maximum weight change rate of 0.5% - 1% of bodyweight per week.
          </p>
        </div>

        {/* Note Template Generation Action */}
        <button
          onClick={handleGenerateNote}
          className="btn btn-secondary btn-block"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--bg-glass-strong)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
        >
          {isGenerated ? (
            <>
              <Check size={16} color="var(--accent)" />
              <span>Log Saved to Journals!</span>
            </>
          ) : (
            <>
              <FileText size={16} color="var(--accent2)" />
              <span>Log Today's Metrics as Note</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
