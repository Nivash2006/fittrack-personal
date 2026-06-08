import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import ProgressPhotos from '../components/ProgressPhotos';
import { 
  calculateBMI, 
  getBMICategory, 
  calculateBMR, 
  calculateTDEE, 
  calculateTargetCalories, 
  calculateMacros,
  calculateWaterTarget
} from '../utils/helpers';

interface ProfileScreenProps {
  onReset: () => void;
}

export default function ProfileScreen({ onReset }: ProfileScreenProps) {
  const profile = useLiveQuery(() => db.userProfiles.toCollection().first());
  const mealCount = useLiveQuery(() => db.meals.count());
  const workoutCount = useLiveQuery(() => db.workouts.count());
  const weightLogs = useLiveQuery(() => db.weightLogs.orderBy('loggedAt').toArray());

  const [showEditModal, setShowEditModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Edit form
  const [editName, setEditName] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editGender, setEditGender] = useState<'male' | 'female'>('male');
  const [editGoal, setEditGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');
  const [editDietType, setEditDietType] = useState<'balanced' | 'low_carb' | 'high_protein'>('balanced');
  const [editActivity, setEditActivity] = useState<'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'>('moderate');

  // Weight log
  const [newWeight, setNewWeight] = useState('');

  const openEditModal = () => {
    if (!profile) return;
    setEditName(profile.name);
    setEditHeight(String(profile.heightCm));
    setEditWeight(String(profile.weightKg));
    setEditAge(String(profile.age));
    setEditGender(profile.gender);
    setEditGoal(profile.goal);
    setEditDietType(profile.dietType || 'balanced');
    setEditActivity(profile.activityLevel);
    setShowEditModal(true);
  };

  const handleSaveProfile = useCallback(async () => {
    if (!profile?.id) return;
    const h = parseInt(editHeight) || profile.heightCm;
    const w = parseFloat(editWeight) || profile.weightKg;
    const a = parseInt(editAge) || profile.age;
    const bmr = calculateBMR(editGender, w, h, a);
    const tdee = calculateTDEE(bmr, editActivity);
    const targetCal = calculateTargetCalories(tdee, editGoal);
    const macros = calculateMacros(targetCal, editGoal, editDietType);
    const water = calculateWaterTarget(w, editActivity);

    await db.userProfiles.update(profile.id, {
      name: editName || profile.name,
      heightCm: h,
      weightKg: w,
      age: a,
      gender: editGender,
      goal: editGoal,
      dietType: editDietType,
      activityLevel: editActivity,
      calorieTarget: targetCal,
      proteinTarget: macros.protein,
      carbTarget: macros.carbs,
      fatTarget: macros.fats,
      waterTarget: water,
    });
    setToast('Profile updated!');
    setShowEditModal(false);
  }, [profile, editName, editHeight, editWeight, editAge, editGender, editGoal, editDietType, editActivity]);

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

  const handleExportData = useCallback(async () => {
    const data = {
      profile: await db.userProfiles.toArray(),
      meals: await db.meals.toArray(),
      workouts: await db.workouts.toArray(),
      weightLogs: await db.weightLogs.toArray(),
      habits: await db.habits.toArray(),
      waterLogs: await db.waterLogs.toArray(),
      sleepLogs: await db.sleepLogs.toArray(),
      stepLogs: await db.stepLogs.toArray(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fittrack-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('Data exported!');
    setShowExportModal(false);
  }, []);

  const handleImportData = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        // Clear existing
        await db.userProfiles.clear();
        await db.meals.clear();
        await db.workouts.clear();
        await db.weightLogs.clear();
        await db.habits.clear();
        await db.waterLogs.clear();
        await db.sleepLogs.clear();
        await db.stepLogs.clear();
        // Import
        if (data.profile) await db.userProfiles.bulkAdd(data.profile);
        if (data.meals) await db.meals.bulkAdd(data.meals);
        if (data.workouts) await db.workouts.bulkAdd(data.workouts);
        if (data.weightLogs) await db.weightLogs.bulkAdd(data.weightLogs);
        if (data.habits) await db.habits.bulkAdd(data.habits);
        if (data.waterLogs) await db.waterLogs.bulkAdd(data.waterLogs);
        if (data.sleepLogs) await db.sleepLogs.bulkAdd(data.sleepLogs);
        if (data.stepLogs) await db.stepLogs.bulkAdd(data.stepLogs);
        setToast('Data imported successfully!');
        setShowExportModal(false);
      } catch {
        setToast('Import failed. Invalid file.');
      }
    };
    input.click();
  }, []);

  const handleResetAll = useCallback(async () => {
    if (!window.confirm('This will delete ALL your data. Are you sure?')) return;
    await db.delete();
    await db.open();
    onReset();
  }, [onReset]);

  if (!profile) return null;

  const bmi = calculateBMI(profile.weightKg, profile.heightCm);
  const bmiCategory = getBMICategory(bmi);
  const latestWeight = weightLogs && weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : profile.weightKg;

  return (
    <div className="animate-in">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="page-header">
        <h1 className="page-header__title">Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="glass-card mb-md" style={{ textAlign: 'center' }}>
        <div className="profile-avatar" style={{ margin: '0 auto var(--space-md)' }}>
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-h2">{profile.name}</h2>
        <p className="text-secondary text-small mt-sm">
          {profile.age} yrs · {profile.heightCm} cm · {latestWeight} kg
        </p>
        <div className="divider" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
          <div className="profile-stat">
            <div className="profile-stat__value" style={{ color: 'var(--accent)' }}>{profile.calorieTarget}</div>
            <div className="profile-stat__label">Cal Target</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat__value" style={{ color: 'var(--protein-color)' }}>{profile.proteinTarget}g</div>
            <div className="profile-stat__label">Protein</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat__value">{bmi}</div>
            <div className="profile-stat__label">BMI</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat__value" style={{
              color: bmiCategory === 'Normal' ? 'var(--accent)' : bmiCategory === 'Overweight' ? 'var(--accent3)' : 'var(--danger)',
              fontSize: '0.75rem'
            }}>
              {bmiCategory}
            </div>
            <div className="profile-stat__label">Status</div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid mb-md">
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div className="text-caption">Meals Logged</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>
            {mealCount ?? 0}
          </div>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div className="text-caption">Workouts</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent2)' }}>
            {workoutCount ?? 0}
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="glass-card mb-md">
        <div className="settings-item" onClick={openEditModal}>
          <div className="settings-item__icon">✏️</div>
          <div className="settings-item__text">
            <div className="settings-item__title">Edit Profile</div>
            <div className="settings-item__subtitle">Update your details and targets</div>
          </div>
          <span className="settings-item__arrow">›</span>
        </div>

        <div className="settings-item" onClick={() => setShowWeightModal(true)}>
          <div className="settings-item__icon">⚖️</div>
          <div className="settings-item__text">
            <div className="settings-item__title">Log Weight</div>
            <div className="settings-item__subtitle">Track your weight progress</div>
          </div>
          <span className="settings-item__arrow">›</span>
        </div>

        <div className="settings-item" onClick={() => setShowExportModal(true)}>
          <div className="settings-item__icon">💾</div>
          <div className="settings-item__text">
            <div className="settings-item__title">Backup & Restore</div>
            <div className="settings-item__subtitle">Export or import your data</div>
          </div>
          <span className="settings-item__arrow">›</span>
        </div>

        <div className="settings-item" onClick={handleResetAll}>
          <div className="settings-item__icon" style={{ background: 'var(--danger-dim)' }}>🗑️</div>
          <div className="settings-item__text">
            <div className="settings-item__title" style={{ color: 'var(--danger)' }}>Reset All Data</div>
            <div className="settings-item__subtitle">Delete everything and start fresh</div>
          </div>
          <span className="settings-item__arrow">›</span>
        </div>
      </div>

      {/* Progress Photos Gallery */}
      <ProgressPhotos />

      {/* App Info */}
      <div className="glass-card mb-lg" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🔥</div>
        <div className="text-h3">FitTrack Personal</div>
        <div className="text-small text-muted mt-sm">v1.0.0 · Made with ❤️</div>
        <div className="text-caption mt-sm">Offline-First · PWA · Free Forever</div>
      </div>

      {/* Edit Profile Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Profile">
        <div className="form-group">
          <label className="form-label">Name</label>
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Age</label>
            <input type="number" value={editAge} onChange={(e) => setEditAge(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Gender</label>
            <select value={editGender} onChange={(e) => setEditGender(e.target.value as 'male' | 'female')}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Height (cm)</label>
            <input type="number" value={editHeight} onChange={(e) => setEditHeight(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Weight (kg)</label>
            <input type="number" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Goal</label>
            <select value={editGoal} onChange={(e) => setEditGoal(e.target.value as 'lose' | 'maintain' | 'gain')}>
              <option value="lose">Lose Weight</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Build Muscle</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Activity</label>
            <select value={editActivity} onChange={(e) => setEditActivity(e.target.value as typeof editActivity)}>
              <option value="sedentary">Sedentary</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="active">Active</option>
              <option value="very_active">Very Active</option>
            </select>
          </div>
        </div>
        <div className="form-group mt-sm">
          <label className="form-label">Diet Profile</label>
          <select value={editDietType} onChange={(e) => setEditDietType(e.target.value as any)}>
            <option value="balanced">🥗 Balanced (Standard split)</option>
            <option value="low_carb">🥩 Low Carb (Higher fat, low carbs)</option>
            <option value="high_protein">💪 High Protein (Maximize protein)</option>
          </select>
        </div>
        <button className="btn btn-primary btn-block mt-md" onClick={handleSaveProfile}>
          Save Changes
        </button>
      </Modal>

      {/* Weight Modal */}
      <Modal isOpen={showWeightModal} onClose={() => setShowWeightModal(false)} title="Log Weight">
        <div className="form-group">
          <label className="form-label">Current Weight (kg)</label>
          <input
            type="number"
            placeholder={String(latestWeight)}
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

      {/* Export Modal */}
      <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Backup & Restore">
        <p className="text-secondary text-small mb-lg">
          Export all your data as a JSON file, or import a previous backup to restore your data.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <button className="btn btn-primary btn-block" onClick={handleExportData}>
            📥 Export Data
          </button>
          <button className="btn btn-secondary btn-block" onClick={handleImportData}>
            📤 Import Data
          </button>
        </div>
      </Modal>
    </div>
  );
}
