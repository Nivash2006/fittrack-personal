import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Clock,
  Pause,
  Play,
  StopCircle,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { db } from '../db/database';
import type { FastingLog } from '../db/database';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = 'fittrack_active_fast';

interface ActiveFastState {
  logId: number;
  startedAt: number;       // unix ms
  targetHours: number;
  type: FastingLog['type'];
  pausedAt: number | null; // unix ms when paused (null = running)
  totalPausedMs: number;   // accumulated paused milliseconds
}

interface Protocol {
  id: FastingLog['type'];
  label: string;
  fast: number;  // fasting hours
  eat: number;   // eating window hours
  tagline: string;
  color: string;
}

const PROTOCOLS: Protocol[] = [
  { id: '16:8',   label: '16:8',  fast: 16, eat: 8,  tagline: 'LeanGains',     color: 'var(--accent)' },
  { id: '18:6',   label: '18:6',  fast: 18, eat: 6,  tagline: 'Warrior Lite',  color: 'var(--accent2)' },
  { id: '20:4',   label: '20:4',  fast: 20, eat: 4,  tagline: 'Warrior Diet',  color: 'var(--accent3)' },
  { id: '24:0',   label: '24:0',  fast: 24, eat: 0,  tagline: 'OMAD',          color: '#ff7c5c' },
  { id: 'custom', label: 'Custom',fast: 0,  eat: 0,  tagline: 'Your schedule', color: '#9a9ab0' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHHMM(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return formatHHMM(totalSeconds);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: true,
  });
}

function getProtocolLabel(fast: FastingLog): string {
  if (fast.type === 'custom') return `Custom ${fast.durationHours}h`;
  return fast.type;
}

function getFastingState(progressRatio: number): string {
  if (progressRatio >= 1)    return 'Goal Reached! 🎉';
  if (progressRatio >= 0.75) return 'Autophagy Active';
  if (progressRatio >= 0.5)  return 'Deep Ketosis';
  if (progressRatio >= 0.25) return 'Lipolysis';
  return 'Fasting';
}

function saveFastState(state: ActiveFastState | null): void {
  if (state) {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(LS_KEY);
  }
}

function loadFastState(): ActiveFastState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ActiveFastState) : null;
  } catch {
    return null;
  }
}

/** Calculate consecutive completed-fast streak (days). */
function calcStreak(logs: FastingLog[]): number {
  const completed = logs.filter((l) => l.completed && l.endedAt);
  if (completed.length === 0) return 0;

  // Get unique dates of completed fasts
  const dates = new Set(
    completed.map((l) => new Date(l.endedAt!).toISOString().split('T')[0])
  );

  let streak = 0;
  const cursor = new Date();

  // Allow current day to count even if not yet done
  for (let i = 0; i <= 60; i++) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (dates.has(ds)) {
      streak++;
    } else if (i > 0) {
      break; // gap in streak
    }
  }
  return streak;
}

// ─── SVG Ring Component ───────────────────────────────────────────────────────

interface RingTimerProps {
  elapsedMs: number;
  targetMs: number;
  isPaused: boolean;
  isGoalReached: boolean;
}

function RingTimer({ elapsedMs, targetMs, isPaused, isGoalReached }: RingTimerProps) {
  const SIZE         = 220;
  const STROKE_OUTER = 14;
  const STROKE_INNER = 6;
  const R_OUTER      = (SIZE - STROKE_OUTER) / 2;
  const R_INNER      = R_OUTER - STROKE_OUTER - 10;
  const C_OUTER      = 2 * Math.PI * R_OUTER;
  const C_INNER      = 2 * Math.PI * R_INNER;

  const progress    = targetMs > 0 ? Math.min(elapsedMs / targetMs, 1) : 0;
  const offset      = C_OUTER - progress * C_OUTER;

  // Inner ring shows eating window fill (complement of fasting)
  const eatRatio    = 1 - progress;
  const eatOffset   = C_INNER - eatRatio * C_INNER;

  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const activeColor   = isGoalReached ? 'var(--accent)' : isPaused ? '#ffb347' : 'var(--accent)';
  const elapsedStr    = formatElapsed(elapsedMs);
  const targetHours   = Math.floor(targetMs / 3600000);
  const statusLabel   = isGoalReached
    ? 'Complete!'
    : isPaused
    ? 'Paused'
    : targetMs === 0
    ? 'Set Target'
    : 'Fasting';

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE, margin: '0 auto' }}>
      <svg
        width={SIZE}
        height={SIZE}
        style={{ transform: 'rotate(-90deg)' }}
        aria-label="Fasting timer ring"
      >
        {/* Outer track */}
        <circle
          cx={cx} cy={cy} r={R_OUTER}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE_OUTER}
        />
        {/* Outer progress (elapsed fasting) */}
        <circle
          cx={cx} cy={cy} r={R_OUTER}
          fill="none"
          stroke={activeColor}
          strokeWidth={STROKE_OUTER}
          strokeDasharray={C_OUTER}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: isPaused ? 'none' : 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
        />
        {/* Inner track (eating window) */}
        <circle
          cx={cx} cy={cy} r={R_INNER}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={STROKE_INNER}
        />
        {/* Inner ring (eating window remaining inverse) */}
        {targetMs > 0 && (
          <circle
            cx={cx} cy={cy} r={R_INNER}
            fill="none"
            stroke="rgba(77,141,255,0.35)"
            strokeWidth={STROKE_INNER}
            strokeDasharray={C_INNER}
            strokeDashoffset={eatOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        )}
      </svg>

      {/* Center content — must be positioned on top, not rotated */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          gap: 4,
        }}
      >
        {targetMs > 0 ? (
          <>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.25rem',
                fontWeight: 800,
                color: activeColor,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                transition: 'color 0.4s ease',
              }}
            >
              {elapsedStr}
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}
            >
              {statusLabel}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              of {targetHours}h goal
            </span>
          </>
        ) : (
          <>
            <Clock size={28} color="var(--text-muted)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Select Protocol
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FastingScreen() {
  // ── Persistent state (survives refresh) ──
  const [activeFast, setActiveFast] = useState<ActiveFastState | null>(() => loadFastState());

  // ── UI state ──
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol>(PROTOCOLS[0]);
  const [customHours, setCustomHours]           = useState<string>('14');
  const [elapsedMs, setElapsedMs]               = useState<number>(0);
  const [showEndModal, setShowEndModal]         = useState(false);
  const [toast, setToast]                       = useState<string | null>(null);
  const [toastType, setToastType]               = useState<'success' | 'error'>('success');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Live DB data ──
  const allFastingLogs = useLiveQuery(() =>
    db.fastingLogs.orderBy('startedAt').reverse().toArray()
  );

  const recentLogs   = allFastingLogs?.filter((l) => l.completed).slice(0, 7) ?? [];
  const streak       = allFastingLogs ? calcStreak(allFastingLogs) : 0;

  // ── Derived ──
  const isActive      = activeFast !== null;
  const isPaused      = activeFast?.pausedAt !== null && activeFast?.pausedAt !== undefined;
  const targetHours   = activeFast?.targetHours ?? (
    selectedProtocol.id === 'custom' ? Number(customHours) || 0 : selectedProtocol.fast
  );
  const targetMs      = targetHours * 3600 * 1000;
  const isGoalReached = isActive && elapsedMs >= targetMs && targetMs > 0;

  // ── Deficit from meals (last-7 average for safety warning) ──
  const allMeals = useLiveQuery(() => db.meals.toArray());
  const profile  = useLiveQuery(() => db.userProfiles.toCollection().first());

  const recentDeficit = (() => {
    if (!allMeals || !profile) return 0;
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = allMeals.filter((m) => m.date === today);
    const consumed = todayMeals.reduce((s, m) => s + m.calories, 0);
    return Math.max(0, profile.calorieTarget - consumed);
  })();

  const showSafetyWarning =
    isActive && targetHours >= 20 && recentDeficit > 500;

  // ── Timer tick ──
  const tick = useCallback(() => {
    setActiveFast((prev) => {
      if (!prev || prev.pausedAt !== null) return prev;
      const now       = Date.now();
      const netElapsed = now - prev.startedAt - prev.totalPausedMs;
      setElapsedMs(Math.max(0, netElapsed));
      return prev;
    });
  }, []);

  // Sync elapsed on mount & when activeFast changes
  useEffect(() => {
    if (!activeFast) {
      setElapsedMs(0);
      return;
    }
    if (activeFast.pausedAt !== null) {
      // Frozen at pause moment
      const frozenElapsed = activeFast.pausedAt - activeFast.startedAt - activeFast.totalPausedMs;
      setElapsedMs(Math.max(0, frozenElapsed));
      return;
    }
    // Running — start interval
    const now        = Date.now();
    const netElapsed = now - activeFast.startedAt - activeFast.totalPausedMs;
    setElapsedMs(Math.max(0, netElapsed));

    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeFast, tick]);

  // Auto-complete when goal reached
  useEffect(() => {
    if (isGoalReached && activeFast) {
      handleComplete(true);
    }
     
  }, [isGoalReached]);

  // ── Persist to localStorage whenever activeFast changes ──
  useEffect(() => {
    saveFastState(activeFast);
  }, [activeFast]);

  // ── Actions ──

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg);
    setToastType(type);
  };

  const handleStart = async () => {
    const hours =
      selectedProtocol.id === 'custom'
        ? Number(customHours) || 0
        : selectedProtocol.fast;

    if (hours <= 0) {
      showToast('Please enter a valid fasting duration.', 'error');
      return;
    }

    const nowISO  = new Date().toISOString();
    const nowMs   = Date.now();
    const fastType = selectedProtocol.id;

    try {
      const logId = await db.fastingLogs.add({
        type: fastType,
        startedAt: nowISO,
        durationHours: hours,
        completed: false,
        totalPausedMs: 0,
      });

      const state: ActiveFastState = {
        logId: logId as number,
        startedAt: nowMs,
        targetHours: hours,
        type: fastType,
        pausedAt: null,
        totalPausedMs: 0,
      };

      setActiveFast(state);
      showToast(`${hours}h fast started. Stay hydrated! 💪`);
    } catch (err) {
      console.error('Failed to start fast:', err);
      showToast('Failed to start fast. Please try again.', 'error');
    }
  };

  const handlePause = async () => {
    if (!activeFast || isPaused) return;
    const pausedAt = Date.now();

    const updated: ActiveFastState = { ...activeFast, pausedAt };
    setActiveFast(updated);
    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      await db.fastingLogs.update(activeFast.logId, { pausedAt: new Date(pausedAt).toISOString() });
    } catch (err) {
      console.error('Failed to pause fast log:', err);
    }
    showToast('Fast paused. Resume when ready.');
  };

  const handleResume = async () => {
    if (!activeFast || !isPaused) return;
    const now         = Date.now();
    const addedPauseMs = now - activeFast.pausedAt!;
    const newTotalPauseMs = activeFast.totalPausedMs + addedPauseMs;

    const updated: ActiveFastState = {
      ...activeFast,
      pausedAt: null,
      totalPausedMs: newTotalPauseMs,
    };
    setActiveFast(updated);

    try {
      await db.fastingLogs.update(activeFast.logId, {
        pausedAt: undefined,
        totalPausedMs: newTotalPauseMs,
      });
    } catch (err) {
      console.error('Failed to resume fast log:', err);
    }
    showToast('Fast resumed. You got this! 🔥');
  };

  const handleComplete = async (auto = false) => {
    if (!activeFast) return;
    const nowISO   = new Date().toISOString();
    const elapsed  = auto ? targetMs : elapsedMs;
    const hours    = Math.round((elapsed / 3600000) * 10) / 10;
    const pct      = targetMs > 0 ? Math.round((elapsed / targetMs) * 100) : 0;

    try {
      await db.fastingLogs.update(activeFast.logId, {
        completed: true,
        endedAt: nowISO,
        totalPausedMs: activeFast.totalPausedMs,
      });

      if (intervalRef.current) clearInterval(intervalRef.current);
      setActiveFast(null);
      setElapsedMs(0);
      showToast(auto
        ? `🎉 Goal reached! ${activeFast.targetHours}h fast complete!`
        : `Fast ended — ${hours}h (${pct}% of goal). Great effort!`
      );
    } catch (err) {
      console.error('Failed to complete fast:', err);
      showToast('Failed to end fast. Please try again.', 'error');
    }
  };

  const handleEndConfirm = async () => {
    setShowEndModal(false);
    await handleComplete(false);
  };

  // ── Progress ratio for ring ──
  const progressRatio = targetMs > 0 ? Math.min(elapsedMs / targetMs, 1) : 0;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="animate-in">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-header__title">Fasting</h1>
        {streak > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(0,230,138,0.1)',
              border: '1px solid rgba(0,230,138,0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '4px 10px',
              marginTop: 4,
            }}
          >
            <Zap size={14} color="var(--accent)" fill="var(--accent)" />
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent)' }}>
              {streak} day streak
            </span>
          </div>
        )}
      </div>

      {/* ── Protocol Selector ── */}
      {!isActive && (
        <div className="glass-card mb-md">
          <div className="section-header" style={{ marginBottom: 'var(--space-md)' }}>
            <span className="section-header__title">Choose Protocol</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--space-sm)',
            }}
          >
            {PROTOCOLS.map((p) => {
              const isSelected = selectedProtocol.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProtocol(p)}
                  style={{
                    background: isSelected
                      ? `rgba(${p.color.includes('accent)') ? '0,230,138' : p.color.includes('accent2') ? '77,141,255' : p.color.includes('accent3') ? '192,132,252' : '255,124,92'}, 0.12)`
                      : 'var(--bg-glass)',
                    border: `1.5px solid ${isSelected ? p.color : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 6px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? `0 0 16px ${p.color}33` : 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-display)',
                      color: isSelected ? p.color : 'var(--text-primary)',
                      marginBottom: 2,
                    }}
                  >
                    {p.label}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {p.tagline}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom hours input */}
          {selectedProtocol.id === 'custom' && (
            <div className="form-group mt-md" style={{ marginBottom: 0 }}>
              <label className="form-label">Fasting Duration (hours)</label>
              <input
                type="number"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                min="1"
                max="36"
                placeholder="14"
                style={{ maxWidth: 120 }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Active Fast Info (visible while running) ── */}
      {isActive && activeFast && (
        <div
          className="glass-card mb-md"
          style={{
            background: 'var(--bg-glass-strong)',
            border: '1px solid rgba(0,230,138,0.15)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div className="text-caption mb-sm">Active Fast</div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {getProtocolLabel({ type: activeFast.type, durationHours: activeFast.targetHours } as FastingLog)}
                &nbsp;·&nbsp;
                <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                  {activeFast.targetHours}h window
                </span>
              </div>
              <div className="text-small text-muted mt-sm">
                Started {formatDateTime(new Date(activeFast.startedAt).toISOString())}
              </div>
            </div>
            <div
              style={{
                background: isPaused ? 'rgba(255,179,71,0.12)' : 'rgba(0,230,138,0.1)',
                border: `1px solid ${isPaused ? 'rgba(255,179,71,0.3)' : 'rgba(0,230,138,0.3)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: isPaused ? '#ffb347' : 'var(--accent)',
                letterSpacing: '0.08em',
              }}
            >
              {isPaused ? 'Paused' : 'Active'}
            </div>
          </div>
        </div>
      )}

      {/* ── Ring Timer ── */}
      <div className="glass-card mb-md" style={{ textAlign: 'center' }}>
        <RingTimer
          elapsedMs={elapsedMs}
          targetMs={targetMs}
          isPaused={isPaused}
          isGoalReached={isGoalReached}
        />

        {/* Fasting state label */}
        {isActive && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 'var(--space-md)',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 14px',
            }}
          >
            <Zap size={13} color="var(--accent)" fill="var(--accent)" />
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {getFastingState(progressRatio)}
            </span>
          </div>
        )}

        {/* Progress percentage */}
        {isActive && targetMs > 0 && (
          <div className="text-small text-muted mt-sm">
            {Math.round(progressRatio * 100)}% complete
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="glass-card mb-md">
        {!isActive ? (
          <button
            className="btn btn-primary btn-block"
            onClick={handleStart}
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, #00b368 100%)',
              color: '#0a1a12',
              fontWeight: 700,
            }}
          >
            <Play size={16} fill="currentColor" />
            Start Fast
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {/* Pause / Resume */}
            {!isPaused ? (
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={handlePause}
              >
                <Pause size={15} />
                Pause
              </button>
            ) : (
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleResume}
              >
                <Play size={15} fill="currentColor" />
                Resume
              </button>
            )}

            {/* Complete fast */}
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => handleComplete(false)}
              disabled={isPaused}
            >
              <CheckCircle2 size={15} />
              Complete
            </button>

            {/* End / Discard */}
            <button
              className="btn btn-danger"
              style={{ padding: '0 14px', flexShrink: 0 }}
              onClick={() => setShowEndModal(true)}
              aria-label="End fast"
            >
              <StopCircle size={17} />
            </button>
          </div>
        )}
      </div>

      {/* ── Safety Warning ── */}
      {showSafetyWarning && (
        <div
          className="mb-md"
          style={{
            display: 'flex',
            gap: 10,
            padding: '12px 14px',
            background: 'rgba(255, 179, 71, 0.08)',
            border: '1px solid rgba(255, 179, 71, 0.25)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertTriangle size={18} color="#ffb347" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#ffb347',
                margin: '0 0 2px',
              }}
            >
              Extended Fast + High Deficit
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              You're fasting 20+ hours while already in a significant calorie deficit today.
              Stay well hydrated and consider breaking your fast if you feel dizzy or unwell.
            </p>
          </div>
        </div>
      )}

      {/* ── Hydration Tip ── */}
      {!showSafetyWarning && (
        <div
          className="mb-md"
          style={{
            display: 'flex',
            gap: 10,
            padding: '10px 14px',
            background: 'rgba(77,141,255,0.06)',
            border: '1px solid rgba(77,141,255,0.15)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertTriangle size={16} color="var(--accent2)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Drink water, black coffee, or herbal tea during your fast. Avoid anything caloric until your eating window.
          </p>
        </div>
      )}

      {/* ── Fasting Log History ── */}
      <div className="glass-card mb-lg">
        <div className="section-header" style={{ marginBottom: 'var(--space-md)' }}>
          <span className="section-header__title">
            <Clock size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Recent Fasts
          </span>
          {streak > 0 && (
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--accent)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              🔥 {streak}-day streak
            </span>
          )}
        </div>

        {recentLogs.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-lg)',
              color: 'var(--text-muted)',
            }}
          >
            <Clock size={32} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <p className="text-small text-muted" style={{ margin: 0 }}>
              No completed fasts yet. Start your first fast above!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {recentLogs.map((log) => {
              const endedMs   = log.endedAt ? new Date(log.endedAt).getTime() : 0;
              const startMs   = new Date(log.startedAt).getTime();
              const pausedMs  = log.totalPausedMs ?? 0;
              const netMs     = endedMs - startMs - pausedMs;
              const netHours  = Math.max(0, Math.round((netMs / 3600000) * 10) / 10);
              const pct       = log.durationHours > 0
                ? Math.min(100, Math.round((netHours / log.durationHours) * 100))
                : 0;

              const isComplete = pct >= 100;

              return (
                <div
                  key={log.id}
                  className="meal-card"
                  style={{
                    borderLeft: `3px solid ${isComplete ? 'var(--accent)' : 'rgba(255,179,71,0.6)'}`,
                  }}
                >
                  <div
                    className="meal-card__icon"
                    style={{
                      background: isComplete ? 'rgba(0,230,138,0.1)' : 'rgba(255,179,71,0.1)',
                    }}
                  >
                    {isComplete
                      ? <CheckCircle2 size={18} color="var(--accent)" />
                      : <Clock size={18} color="#ffb347" />
                    }
                  </div>
                  <div className="meal-card__info">
                    <div className="meal-card__name">
                      {getProtocolLabel(log)}
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: isComplete ? 'var(--accent)' : '#ffb347',
                          background: isComplete ? 'rgba(0,230,138,0.1)' : 'rgba(255,179,71,0.1)',
                          borderRadius: 4,
                          padding: '1px 6px',
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="meal-card__meta">
                      {log.endedAt ? formatDateTime(log.endedAt) : '—'}
                    </div>
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {netHours}h
                    </div>
                    <div className="text-small text-muted">fasted</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── End Fast Modal ── */}
      <Modal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        title="End Fast?"
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: 'var(--space-md)' }}>
          Ending the fast now will log your progress so far (
          <strong style={{ color: 'var(--text-primary)' }}>
            {formatElapsed(elapsedMs)}
          </strong>{' '}
          elapsed). Your partial fast will be saved to history.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button
            className="btn btn-danger"
            style={{ flex: 1 }}
            onClick={handleEndConfirm}
          >
            <StopCircle size={15} />
            End Fast
          </button>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={() => setShowEndModal(false)}
          >
            Keep Going
          </button>
        </div>
      </Modal>

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast}
          type={toastType}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
