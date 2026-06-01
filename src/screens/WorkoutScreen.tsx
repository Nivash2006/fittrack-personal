import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { EXERCISE_DATABASE, searchExercises, getExercisesByCategory, EXERCISE_CATEGORIES, type Exercise } from '../db/exercises';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { getTodayStr, formatDateShort } from '../utils/helpers';

export default function WorkoutScreen() {
  const today = getTodayStr();
  const todayWorkouts = useLiveQuery(() => db.workouts.where('date').equals(today).toArray(), [today]);
  const recentWorkouts = useLiveQuery(() => db.workouts.toCollection().reverse().limit(30).toArray());

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<Array<{ reps: number; weight: number }>>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'today' | 'history'>('today');

  const filteredExercises = searchQuery.length >= 2
    ? searchExercises(searchQuery)
    : filterCategory
      ? getExercisesByCategory(filterCategory as Exercise['category'])
      : EXERCISE_DATABASE.slice(0, 15);

  const handleSelectExercise = (ex: Exercise) => {
    setSelectedExercise(ex);
    const initialSets = Array.from({ length: ex.defaultSets }, () => ({
      reps: ex.defaultReps,
      weight: 0,
    }));
    setSets(initialSets);
  };

  const updateSet = (idx: number, field: 'reps' | 'weight', value: number) => {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const addSet = () => {
    const last = sets[sets.length - 1] || { reps: 10, weight: 0 };
    setSets([...sets, { ...last }]);
  };

  const removeSet = (idx: number) => {
    if (sets.length <= 1) return;
    setSets(sets.filter((_, i) => i !== idx));
  };

  const handleSaveWorkout = useCallback(async () => {
    if (!selectedExercise) return;
    await db.workouts.add({
      exercise: selectedExercise.name,
      category: selectedExercise.category,
      sets,
      date: today,
      createdAt: new Date().toISOString(),
    });
    setToast(`${selectedExercise.name} logged!`);
    setSelectedExercise(null);
    setSets([]);
    setSearchQuery('');
    setShowAddModal(false);
  }, [selectedExercise, sets, today]);

  const handleDeleteWorkout = useCallback(async (id: number) => {
    await db.workouts.delete(id);
    setToast('Workout removed');
  }, []);

  // Group history by date
  const historyByDate = (recentWorkouts ?? []).reduce<Record<string, typeof recentWorkouts>>((acc, w) => {
    if (!acc[w.date]) acc[w.date] = [];
    acc[w.date]!.push(w);
    return acc;
  }, {});

  const totalVolume = (todayWorkouts ?? []).reduce((sum, w) => {
    return sum + w.sets.reduce((s, set) => s + set.reps * set.weight, 0);
  }, 0);

  return (
    <div className="animate-in">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="page-header">
        <h1 className="page-header__title">Workout Tracker</h1>
      </div>

      {/* Today Stats */}
      <div className="stats-grid mb-md">
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div className="text-caption">Exercises</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--accent2)' }}>
            {todayWorkouts?.length ?? 0}
          </div>
        </div>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div className="text-caption">Volume (kg)</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--accent3)' }}>
            {Math.round(totalVolume)}
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="tab-switcher">
        <button className={`tab-switcher__tab ${viewMode === 'today' ? 'active' : ''}`} onClick={() => setViewMode('today')}>
          Today
        </button>
        <button className={`tab-switcher__tab ${viewMode === 'history' ? 'active' : ''}`} onClick={() => setViewMode('history')}>
          History
        </button>
      </div>

      {viewMode === 'today' ? (
        <>
          {(!todayWorkouts || todayWorkouts.length === 0) ? (
            <div className="empty-state">
              <div className="empty-state__icon">🏋️</div>
              <div className="empty-state__title">No workouts today</div>
              <div className="empty-state__text">Start logging your exercises!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              {todayWorkouts.map((w) => (
                <div key={w.id} className="workout-card">
                  <div className="workout-card__header">
                    <span className="workout-card__exercise">{w.exercise}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <span className="workout-card__category">{w.category}</span>
                      <button
                        className="btn btn-ghost"
                        onClick={() => w.id && handleDeleteWorkout(w.id)}
                        style={{ padding: '2px 6px', color: 'var(--danger)', fontSize: '0.875rem' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="workout-card__sets">
                    {w.sets.map((s, i) => (
                      <span key={i} className="set-badge">
                        {s.reps}×{s.weight > 0 ? `${s.weight}kg` : 'BW'}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-primary btn-block" onClick={() => setShowAddModal(true)}>
            💪 Log Exercise
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {Object.keys(historyByDate).length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📋</div>
              <div className="empty-state__title">No workout history</div>
              <div className="empty-state__text">Your logged workouts will appear here</div>
            </div>
          ) : (
            Object.entries(historyByDate).map(([date, workouts]) => (
              <div key={date}>
                <div className="text-caption mb-sm">{formatDateShort(date)}</div>
                {workouts?.map((w) => (
                  <div key={w.id} className="workout-card">
                    <div className="workout-card__header">
                      <span className="workout-card__exercise">{w.exercise}</span>
                      <span className="workout-card__category">{w.category}</span>
                    </div>
                    <div className="workout-card__sets">
                      {w.sets.map((s, i) => (
                        <span key={i} className="set-badge">
                          {s.reps}×{s.weight > 0 ? `${s.weight}kg` : 'BW'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Exercise Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setSelectedExercise(null); setSearchQuery(''); }} title="Log Exercise">
        {!selectedExercise ? (
          <>
            <div className="search-bar">
              <span className="search-bar__icon">🔍</span>
              <input
                type="text"
                placeholder="Search exercises..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
              <button className={`chip ${!filterCategory ? 'active' : ''}`} onClick={() => setFilterCategory('')}>
                All
              </button>
              {EXERCISE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`chip ${filterCategory === cat ? 'active' : ''}`}
                  onClick={() => setFilterCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              {filteredExercises.map((ex, i) => (
                <button
                  key={i}
                  className="meal-card glass-card--interactive"
                  onClick={() => handleSelectExercise(ex)}
                >
                  <div className="meal-card__info">
                    <div className="meal-card__name">{ex.name}</div>
                    <div className="meal-card__meta">{ex.category} · {ex.defaultSets}×{ex.defaultReps}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="glass-card glass-card--accent mb-md" style={{ padding: 'var(--space-md)' }}>
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{selectedExercise.name}</div>
              <div className="text-small text-secondary">{selectedExercise.category}</div>
            </div>
            <div className="text-caption mb-sm">Sets</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              {sets.map((set, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span className="text-muted" style={{ width: 28, fontSize: '0.8125rem', fontWeight: 600 }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '0.625rem', marginBottom: 2 }}>Reps</label>
                    <input
                      type="number"
                      value={set.reps}
                      onChange={(e) => updateSet(i, 'reps', Number(e.target.value))}
                      style={{ padding: '8px', fontSize: '0.875rem' }}
                      min="1"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '0.625rem', marginBottom: 2 }}>Weight (kg)</label>
                    <input
                      type="number"
                      value={set.weight}
                      onChange={(e) => updateSet(i, 'weight', Number(e.target.value))}
                      style={{ padding: '8px', fontSize: '0.875rem' }}
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <button
                    className="btn btn-ghost"
                    onClick={() => removeSet(i)}
                    style={{ padding: '4px 8px', color: 'var(--danger)', fontSize: '0.875rem', marginTop: 16 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary btn-block btn-sm mb-md" onClick={addSet}>
              + Add Set
            </button>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary flex-1" onClick={() => setSelectedExercise(null)}>
                Back
              </button>
              <button className="btn btn-primary flex-1" onClick={handleSaveWorkout}>
                Save Workout
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
