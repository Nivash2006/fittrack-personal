import { useState, useEffect, useRef } from 'react';
import { Play, Square, AlertTriangle, Zap, Flame } from 'lucide-react';
import { db } from '../db/database';

export default function FastingTimer() {
  const [fastHours, setFastHours] = useState(16);
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const timerInterval = useRef<any>(null);

  // Load active fasting log from Dexie.js
  useEffect(() => {
    const loadActiveFast = async () => {
      try {
        const activeLogs = await db.fastingLogs
          .filter(log => !log.completed)
          .toArray();
        
        if (activeLogs.length > 0) {
          const log = activeLogs[0];
          const startMs = new Date(log.startedAt).getTime();
          setStartTime(startMs);
          setIsActive(true);
          setFastHours(log.durationHours);
          if (log.id) setActiveLogId(log.id);
        }
      } catch (err) {
        console.error('Error loading active fast:', err);
      }
    };
    loadActiveFast();
  }, []);

  // Update timer counters
  useEffect(() => {
    if (isActive && startTime) {
      const tick = () => {
        const now = Date.now();
        const elapsedSecs = Math.max(0, Math.floor((now - startTime) / 1000));
        setElapsedTime(elapsedSecs);

        const targetSecs = fastHours * 60 * 60;
        const remaining = Math.max(0, targetSecs - elapsedSecs);
        setTimeLeft(remaining);

        if (elapsedSecs >= targetSecs && isActive) {
          // Fast completed!
          handleComplete();
        }
      };

      tick();
      timerInterval.current = setInterval(tick, 1000);
    } else {
      setTimeLeft(fastHours * 60 * 60);
      setElapsedTime(0);
    }

    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [isActive, startTime, fastHours]);

  const handleStart = async () => {
    const nowISO = new Date().toISOString();
    const startMs = Date.now();

    try {
      // Save new fast log to Dexie
      const id = await db.fastingLogs.add({
        type: fastHours === 16 ? '16:8' : fastHours === 18 ? '18:6' : fastHours === 20 ? '20:4' : fastHours === 24 ? '24:0' : 'custom',
        startedAt: nowISO,
        durationHours: fastHours,
        completed: false
      });

      setStartTime(startMs);
      setIsActive(true);
      setActiveLogId(id);
    } catch (err) {
      console.error('Failed to start fast log:', err);
    }
  };

  const handleComplete = async () => {
    if (!activeLogId) return;

    try {
      const nowISO = new Date().toISOString();
      await db.fastingLogs.update(activeLogId, {
        completed: true,
        endedAt: nowISO
      });

      if (timerInterval.current) clearInterval(timerInterval.current);
      setIsActive(false);
      setStartTime(null);
      setActiveLogId(null);
      alert(`🎉 Fantastic! You completed your ${fastHours}-hour fast! Keep up the dedication.`);
    } catch (err) {
      console.error('Failed to complete fast log:', err);
    }
  };

  const handleCancel = async () => {
    if (!activeLogId) return;

    if (!confirm('Are you sure you want to stop your current fast? Your progress will not be logged.')) {
      return;
    }

    try {
      await db.fastingLogs.delete(activeLogId);
      if (timerInterval.current) clearInterval(timerInterval.current);
      setIsActive(false);
      setStartTime(null);
      setActiveLogId(null);
    } catch (err) {
      console.error('Failed to cancel fast log:', err);
    }
  };

  const formatDuration = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Circular calculations
  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const totalTargetSecs = fastHours * 60 * 60;
  const progressRatio = isActive ? Math.min(elapsedTime / totalTargetSecs, 1) : 0;
  const offset = circumference - progressRatio * circumference;

  return (
    <div className="glass-card fasting-card" style={{ marginBottom: 'var(--space-lg)' }}>
      <div className="section-header" style={{ marginBottom: 'var(--space-md)' }}>
        <h3 className="section-header__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Flame size={20} color="var(--accent3)" />
          Fasting Tracker
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', width: '100%', marginBottom: 'var(--space-xs)' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Choose Plan
            </label>
            <select
              disabled={isActive}
              value={fastHours}
              onChange={(e) => setFastHours(Number(e.target.value))}
              style={{ width: '100%' }}
            >
              <option value={16}>16:8 (LeanGains)</option>
              <option value={18}>18:6 (Warrior Lite)</option>
              <option value={20}>20:4 (The Warrior Diet)</option>
              <option value={24}>24:0 (OMAD)</option>
            </select>
          </div>
        </div>

        {/* Circular Display Ring */}
        <div className="circular-progress" style={{ width: size, height: size, margin: '10px 0' }}>
          <svg width={size} height={size}>
            <circle
              className="circular-progress__track"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
            />
            <circle
              className="circular-progress__bar"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
              stroke="var(--accent3)"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="circular-progress__content" style={{ top: '50%', transform: 'translateY(-50%)' }}>
            <span className="circular-progress__value" style={{ color: 'var(--accent3)', fontSize: '1.75rem', fontWeight: '800' }}>
              {formatDuration(isActive ? timeLeft : totalTargetSecs)}
            </span>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: '4px', letterSpacing: '0.05em' }}>
              {isActive ? 'Remaining' : 'Configured'}
            </span>
          </div>
        </div>

        {/* Dynamic State Metrics */}
        {isActive && (
          <div style={{ display: 'flex', width: '100%', gap: 'var(--space-md)', justifyContent: 'space-around', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', padding: '10px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Elapsed</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                {formatDuration(elapsedTime)}
              </div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-subtle)' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Fasting State</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                <Zap size={12} fill="var(--accent)" />
                {progressRatio >= 0.75 ? 'Autophagy' : progressRatio >= 0.5 ? 'Ketosis' : 'Lipolysis'}
              </div>
            </div>
          </div>
        )}

        <div style={{ width: '100%', display: 'flex', gap: 'var(--space-md)' }}>
          {!isActive ? (
            <button onClick={handleStart} className="btn btn-primary btn-block" style={{ background: 'linear-gradient(135deg, var(--accent3) 0%, #d48817 100%)', color: 'var(--text-inverse)' }}>
              <Play size={16} fill="var(--text-inverse)" />
              Start Fasting Session
            </button>
          ) : (
            <>
              <button onClick={handleComplete} className="btn btn-primary" style={{ flex: 1 }}>
                Complete Fast
              </button>
              <button onClick={handleCancel} className="btn btn-danger btn-icon" style={{ flexShrink: 0 }} aria-label="Cancel fast">
                <Square size={16} fill="currentColor" />
              </button>
            </>
          )}
        </div>

        <div className="guidance-tip" style={{ display: 'flex', gap: '8px', padding: '10px', background: 'rgba(255, 179, 71, 0.05)', border: '1px solid rgba(255, 179, 71, 0.15)', borderRadius: 'var(--radius-md)', width: '100%' }}>
          <AlertTriangle size={16} color="var(--accent3)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
            Ensure you stay hydrated by drinking water, black coffee, or herbal tea. Avoid consuming calories during the fasting window.
          </p>
        </div>
      </div>
    </div>
  );
}
