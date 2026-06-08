/**
 * Rest Timer — Circular countdown modal for between workout sets.
 *
 * Features:
 *  - SVG circular progress ring (Apple Watch style, drains green → gray)
 *  - Preset buttons: 60s / 90s / 120s
 *  - Start / Pause / Reset controls
 *  - Large countdown number in center
 *  - Vibration on completion (navigator.vibrate if supported)
 *  - Auto-close 3 s after completion with 'Done!' flash
 *  - Glassmorphism dark overlay
 *  - All CSS via design-system variables — zero external deps
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Play, Pause, RotateCcw, Timer } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RestTimerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Default countdown duration in seconds. Defaults to 90. */
  defaultSeconds?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: '60s', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '120s', seconds: 120 },
] as const;

const RING_SIZE = 220;
const STROKE_WIDTH = 14;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ─── Component ────────────────────────────────────────────────────────────────

export default function RestTimer({
  isOpen,
  onClose,
  defaultSeconds = 90,
}: RestTimerProps) {
  const [totalSeconds, setTotalSeconds]   = useState(defaultSeconds);
  const [timeLeft, setTimeLeft]           = useState(defaultSeconds);
  const [isRunning, setIsRunning]         = useState(false);
  const [isDone, setIsDone]               = useState(false);

  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCloseRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cleanup helpers ───────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (intervalRef.current)  clearInterval(intervalRef.current);
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    intervalRef.current  = null;
    autoCloseRef.current = null;
  }, []);

  // ── Reset all state to a fresh countdown ─────────────────────────────────
  const resetTimer = useCallback(
    (seconds: number = totalSeconds) => {
      clearTimers();
      setTimeLeft(seconds);
      setIsRunning(false);
      setIsDone(false);
    },
    [totalSeconds, clearTimers]
  );

  // ── Preset selection ──────────────────────────────────────────────────────
  const selectPreset = useCallback(
    (seconds: number) => {
      setTotalSeconds(seconds);
      resetTimer(seconds);
    },
    [resetTimer]
  );

  // ── Completion handler ────────────────────────────────────────────────────
  const handleComplete = useCallback(() => {
    clearTimers();
    setIsRunning(false);
    setTimeLeft(0);
    setIsDone(true);

    // Haptic feedback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([200, 100, 200]); } catch { /* ignore */ }
    }

    // Auto-close after 3 s
    autoCloseRef.current = setTimeout(() => {
      setIsDone(false);
      onClose();
    }, 3000);
  }, [clearTimers, onClose]);

  // ── Tick ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, handleComplete]);

  // ── Reset when modal re-opens ─────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      resetTimer(defaultSeconds);
    } else {
      clearTimers();
    }
     
  }, [isOpen]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => clearTimers(), [clearTimers]);

  if (!isOpen) return null;

  // ── Derived display values ────────────────────────────────────────────────
  const progress       = totalSeconds > 0 ? timeLeft / totalSeconds : 0;
  const strokeOffset   = CIRCUMFERENCE - progress * CIRCUMFERENCE;
  const minutes        = Math.floor(timeLeft / 60);
  const seconds        = timeLeft % 60;
  const displayTime    = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Colour transitions from green → amber → red as time runs out
  let ringColor = 'var(--accent)';
  if (progress < 0.33) ringColor = 'var(--danger)';
  else if (progress < 0.55) ringColor = 'var(--accent3)';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={() => { clearTimers(); onClose(); }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          zIndex: 'var(--z-modal-backdrop)' as React.CSSProperties['zIndex'],
          animation: 'fadeIn 200ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* ── Modal panel ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rest Timer"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 'var(--z-modal)' as React.CSSProperties['zIndex'],
          background: 'var(--bg-secondary)',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderTopRightRadius: 'var(--radius-xl)',
          padding: 'var(--space-lg)',
          paddingBottom: 'calc(var(--space-2xl) + env(safe-area-inset-bottom, 0px))',
          animation: 'slideUp 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          border: '1px solid var(--border-subtle)',
          borderBottom: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 40,
            height: 4,
            background: 'var(--text-muted)',
            borderRadius: 'var(--radius-full)',
            margin: '0 auto var(--space-md)',
          }}
        />

        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-lg)',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.125rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
            }}
          >
            <Timer size={20} color="var(--accent2)" />
            Rest Timer
          </h3>

          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => { clearTimers(); onClose(); }}
            aria-label="Close rest timer"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Preset selector */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            justifyContent: 'center',
            marginBottom: 'var(--space-lg)',
          }}
        >
          {PRESETS.map((p) => (
            <button
              key={p.seconds}
              className={`btn btn-sm ${totalSeconds === p.seconds ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => selectPreset(p.seconds)}
              disabled={isRunning}
              style={{
                minWidth: 64,
                opacity: isRunning ? 0.5 : 1,
                cursor: isRunning ? 'not-allowed' : 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* SVG ring + countdown */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 'var(--space-lg)',
          }}
        >
          <div
            className="circular-progress"
            style={{ width: RING_SIZE, height: RING_SIZE, position: 'relative' }}
          >
            <svg width={RING_SIZE} height={RING_SIZE} style={{ transform: 'rotate(-90deg)' }}>
              {/* Track (gray) */}
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="var(--bg-glass-strong)"
                strokeWidth={STROKE_WIDTH}
              />
              {/* Progress arc */}
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={isDone ? 'var(--accent)' : ringColor}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={isDone ? 0 : strokeOffset}
                style={{
                  transition: isDone
                    ? 'stroke-dashoffset 0.4s ease, stroke 0.4s ease'
                    : 'stroke-dashoffset 0.9s linear, stroke 0.4s ease',
                  filter: `drop-shadow(0 0 8px ${isDone ? 'var(--accent)' : ringColor})`,
                }}
              />
            </svg>

            {/* Centre content */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              {isDone ? (
                <>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '2.25rem',
                      fontWeight: 900,
                      color: 'var(--accent)',
                      lineHeight: 1,
                      animation: 'pulse 0.6s ease-in-out infinite alternate',
                    }}
                  >
                    Done!
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginTop: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 600,
                    }}
                  >
                    Back to work
                  </span>
                </>
              ) : (
                <>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '3rem',
                      fontWeight: 900,
                      color: ringColor,
                      lineHeight: 1,
                      letterSpacing: '-0.02em',
                      transition: 'color 0.4s ease',
                    }}
                  >
                    {displayTime}
                  </span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                      marginTop: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      fontWeight: 600,
                    }}
                  >
                    {isRunning ? 'Resting' : timeLeft === totalSeconds ? 'Ready' : 'Paused'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        {!isDone && (
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-md)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {/* Reset */}
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => resetTimer()}
              aria-label="Reset timer"
              style={{ width: 48, height: 48 }}
            >
              <RotateCcw size={18} />
            </button>

            {/* Play / Pause */}
            <button
              className="btn btn-primary"
              onClick={() => setIsRunning((r) => !r)}
              aria-label={isRunning ? 'Pause timer' : 'Start timer'}
              style={{
                width: 80,
                height: 56,
                borderRadius: 'var(--radius-lg)',
                fontSize: '1rem',
              }}
            >
              {isRunning ? <Pause size={22} fill="var(--text-inverse)" /> : <Play size={22} fill="var(--text-inverse)" />}
            </button>

            {/* Skip (instant-done) */}
            <button
              className="btn btn-ghost btn-icon"
              onClick={onClose}
              aria-label="Skip rest"
              style={{
                width: 48,
                height: 48,
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <X size={16} />
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Skip
              </span>
            </button>
          </div>
        )}

        {/* Progress bar (secondary linear indicator) */}
        <div
          style={{
            marginTop: 'var(--space-lg)',
            height: 4,
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-glass-strong)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              borderRadius: 'var(--radius-full)',
              background: isDone
                ? 'var(--accent)'
                : `linear-gradient(90deg, ${ringColor}, var(--accent))`,
              transition: 'width 0.9s linear, background 0.4s ease',
            }}
          />
        </div>

        {/* Tip */}
        <p
          style={{
            marginTop: 'var(--space-md)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          60–120 s rest between sets optimises strength recovery.
          {' '}
          <span style={{ color: 'var(--accent2)' }}>90 s</span> is ideal for hypertrophy.
        </p>
      </div>

      {/* Inline keyframe for Done! pulse (CSS @keyframes not injectable in JSX — use style tag) */}
      <style>{`
        @keyframes pulse {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0.75; transform: scale(1.06); }
        }
      `}</style>
    </>
  );
}
