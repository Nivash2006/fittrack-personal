import { useState, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { EXERCISE_DATABASE, searchExercises, getExercisesByCategory, EXERCISE_CATEGORIES, type Exercise } from '../db/exercises';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { getTodayStr, formatDateShort } from '../utils/helpers';
import { 
  getExerciseSessions, 
  isNewPersonalRecord, 
  assessFatigue, 
  getOverloadSuggestion, 
  WORKOUT_TEMPLATES 
} from '../utils/workoutCoach';
import RestTimer from '../components/RestTimer';

export default function WorkoutScreen() {
  const today = getTodayStr();
  const todayWorkouts = useLiveQuery(() => db.workouts.where('date').equals(today).toArray(), [today]);
  const recentWorkouts = useLiveQuery(() => db.workouts.toCollection().reverse().limit(30).toArray());
  const allWorkouts = useLiveQuery(() => db.workouts.toArray());
  const todaySleep = useLiveQuery(() => db.sleepLogs.where('date').equals(today).first(), [today]);
  const todayMeals = useLiveQuery(() => db.meals.where('date').equals(today).toArray(), [today]);
  const profile = useLiveQuery(() => db.userProfiles.toCollection().first());

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<Array<{ reps: number; weight: number }>>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'today' | 'history' | 'templates'>('today');

  // V2 workout coach states
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restTimerSeconds, setRestTimerSeconds] = useState(90);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<{ name: string; exercises: string[] } | null>(() => {
    const raw = localStorage.getItem('fittrack_active_template');
    return raw ? JSON.parse(raw) : null;
  });

  const saveActiveTemplate = (tpl: any) => {
    setActiveTemplate(tpl);
    if (tpl) {
      localStorage.setItem('fittrack_active_template', JSON.stringify(tpl));
    } else {
      localStorage.removeItem('fittrack_active_template');
    }
  };

  const fatigue = useMemo(() => {
    if (!profile) return { level: 'low' as const };
    return assessFatigue(todaySleep, todayMeals ?? [], profile);
  }, [todaySleep, todayMeals, profile]);

  const suggestion = useMemo(() => {
    if (!selectedExercise || !allWorkouts) return null;
    return getOverloadSuggestion(selectedExercise.name, allWorkouts, fatigue.level);
  }, [selectedExercise, allWorkouts, fatigue]);

  const prevSessions = useMemo(() => {
    if (!selectedExercise || !allWorkouts) return [];
    return getExerciseSessions(selectedExercise.name, allWorkouts);
  }, [selectedExercise, allWorkouts]);
  const lastSession = prevSessions[0] || null;

  const handleApplyOverload = () => {
    if (!suggestion || !selectedExercise) return;
    const updated = Array.from({ length: selectedExercise.defaultSets }, () => ({
      reps: suggestion.suggestedReps,
      weight: suggestion.suggestedWeight,
    }));
    setSets(updated);
    setToast('Applied progressive overload targets!');
  };

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

    // Check for new Personal Record before adding this workout
    const isPR = isNewPersonalRecord(selectedExercise.name, sets, allWorkouts ?? []);

    await db.workouts.add({
      exercise: selectedExercise.name,
      category: selectedExercise.category,
      sets,
      date: today,
      createdAt: new Date().toISOString(),
    });

    if (isPR) {
      const maxWeight = Math.max(...sets.map((s) => s.weight));
      const maxReps = sets.reduce((m, s) => s.weight === maxWeight ? Math.max(m, s.reps) : m, 0);
      const best1RM = Math.max(0, ...sets.map((s) => s.weight * (1 + s.reps / 30)));
      
      await db.personalRecords.add({
        exercise: selectedExercise.name,
        maxWeight,
        maxReps,
        estimated1RM: Math.round(best1RM * 10) / 10,
        date: today,
        createdAt: new Date().toISOString(),
      });
      setToast(`🎉 New Personal Record for ${selectedExercise.name}!`);
    } else {
      setToast(`${selectedExercise.name} logged!`);
    }

    // Trigger rest timer for strength categories
    if (selectedExercise.category !== 'cardio') {
      setRestTimerSeconds(90);
      setShowRestTimer(true);
    }

    setSelectedExercise(null);
    setSets([]);
    setSearchQuery('');
    setShowAddModal(false);
  }, [selectedExercise, sets, today, allWorkouts]);

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
        <button className={`tab-switcher__tab ${viewMode === 'templates' ? 'active' : ''}`} onClick={() => setViewMode('templates')}>
          Templates
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
      ) : viewMode === 'templates' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {activeTemplate && (
            <div className="glass-card mb-md" style={{ border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0, 230, 138, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <div>
                  <div className="text-caption">Active Session</div>
                  <div style={{ fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--accent)' }}>
                    {activeTemplate.name}
                  </div>
                </div>
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    saveActiveTemplate(null);
                    setToast('Workout session cleared.');
                  }}
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  End Session
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {activeTemplate.exercises.map((exName) => {
                  const loggedToday = todayWorkouts?.some((w) => w.exercise.toLowerCase() === exName.toLowerCase());
                  return (
                    <div 
                      key={exName} 
                      className="meal-card"
                      style={{ cursor: loggedToday ? 'default' : 'pointer', opacity: loggedToday ? 0.6 : 1 }}
                      onClick={() => {
                        if (loggedToday) return;
                        const match = EXERCISE_DATABASE.find((ex) => ex.name.toLowerCase() === exName.toLowerCase());
                        if (match) {
                          handleSelectExercise(match);
                          setShowAddModal(true);
                        } else {
                          // Fallback to custom
                          handleSelectExercise({ name: exName, category: 'other', defaultSets: 3, defaultReps: 10 });
                          setShowAddModal(true);
                        }
                      }}
                    >
                      <div className="meal-card__icon" style={{ background: loggedToday ? 'var(--accent-dim)' : 'var(--bg-glass-strong)' }}>
                        {loggedToday ? '✅' : '💪'}
                      </div>
                      <div className="meal-card__info">
                        <div className="meal-card__name">{exName}</div>
                        <div className="meal-card__meta">
                          {loggedToday ? 'Completed today' : 'Tap to log sets'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="text-caption">Available Routines</div>
            {WORKOUT_TEMPLATES.map((tpl) => (
              <div 
                key={tpl.name} 
                className="glass-card glass-card--interactive"
                onClick={() => setSelectedTemplate(tpl)}
              >
                <div style={{ fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '1.125rem', marginBottom: 4, color: 'var(--text-primary)' }}>
                  {tpl.name}
                </div>
                <div className="text-small text-secondary" style={{ marginBottom: 'var(--space-md)' }}>
                  {tpl.description}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="chip" style={{ background: 'var(--bg-glass-strong)', textTransform: 'capitalize' }}>
                    {tpl.category} · {tpl.exercises.length} Exercises
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent2)' }}>View details →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
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

            {/* V2 Last Session Box */}
            {lastSession && (
              <div className="glass-card mb-md" style={{ padding: '10px 12px', background: 'var(--bg-glass-strong)', fontSize: '0.8125rem', borderLeft: '3px solid var(--accent2)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>⏮️ Last Session: </span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {formatDateShort(lastSession.date)} · Max: {lastSession.maxWeight > 0 ? `${lastSession.maxWeight} kg` : 'BW'} × {lastSession.maxReps} reps · Vol: {lastSession.totalVolume} kg
                </span>
              </div>
            )}

            {/* V2 Progressive Overload Suggestion */}
            {suggestion && (
              <div className="glass-card mb-md" style={{ padding: '12px', border: '1px solid rgba(0, 230, 138, 0.15)', background: 'rgba(0, 230, 138, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '1rem' }}>⚡</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--accent)' }}>Overload Target</span>
                  </div>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={handleApplyOverload}
                    style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--accent)', background: 'rgba(0, 230, 138, 0.1)', border: '1px solid rgba(0,230,138,0.2)' }}
                  >
                    Apply Suggestion
                  </button>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Target: <strong>{suggestion.suggestedWeight > 0 ? `${suggestion.suggestedWeight} kg` : 'Bodyweight'} × {suggestion.suggestedReps} reps</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {suggestion.reason}
                </div>
                {suggestion.fatigueWarning && (
                  <div style={{ fontSize: '0.75rem', color: '#ffb347', display: 'flex', gap: 4, alignItems: 'center', marginTop: 6 }}>
                    <span>⚠️</span>
                    <span>{suggestion.fatigueWarning}</span>
                  </div>
                )}
              </div>
            )}

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
      {/* Template Detail Modal */}
      {selectedTemplate && (
        <Modal 
          isOpen={!!selectedTemplate} 
          onClose={() => setSelectedTemplate(null)} 
          title={selectedTemplate.name}
        >
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <p className="text-small text-secondary" style={{ fontStyle: 'italic', marginBottom: 'var(--space-md)', lineHeight: 1.4 }}>
              {selectedTemplate.description}
            </p>
            <div className="text-caption mb-sm">Routine Checklist</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', maxHeight: 240, overflowY: 'auto', marginBottom: 'var(--space-md)' }}>
              {selectedTemplate.exercises.map((ex: any, i: number) => (
                <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{ex.exerciseName}</span>
                  <span className="text-caption" style={{ fontSize: '0.75rem' }}>
                    {ex.defaultSets} sets × {ex.defaultReps} reps
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button 
            className="btn btn-primary btn-block"
            onClick={() => {
              saveActiveTemplate({
                name: selectedTemplate.name,
                exercises: selectedTemplate.exercises.map((e: any) => e.exerciseName),
              });
              setSelectedTemplate(null);
              setToast(`Started ${selectedTemplate.name}!`);
            }}
          >
            Start Workout Routine
          </button>
        </Modal>
      )}

      {/* V2 Rest Timer Overlay */}
      {showRestTimer && (
        <RestTimer 
          isOpen={showRestTimer}
          onClose={() => setShowRestTimer(false)}
          defaultSeconds={restTimerSeconds}
        />
      )}
    </div>
  );
}
