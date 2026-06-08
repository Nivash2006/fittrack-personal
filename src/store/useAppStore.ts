/**
 * FitTrack Personal — Zustand Global App Store
 *
 * Central state management for cross-cutting app concerns.
 * Keeps component state focused, prevents prop-drilling,
 * and provides reactive global state for UI/UX patterns.
 */

import { create } from 'zustand';
import type { UserProfile } from '../db/database';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface AppState {
  // ── Active Fast State ───────────────────────────────────────────────────
  activeFast: {
    isRunning: boolean;
    startedAt: string | null;     // ISO timestamp
    targetHours: number;
    protocol: string;
    pausedAt: string | null;      // ISO timestamp when paused
    totalPausedMs: number;        // accumulated pause duration
  } | null;

  // ── Toast Queue ──────────────────────────────────────────────────────────
  toasts: Toast[];

  // ── Suggestion History (for diversity tracking) ──────────────────────────
  recentSuggestions: string[];

  // ── Cached Profile (to avoid repeated DB reads) ──────────────────────────
  cachedProfile: UserProfile | null;

  // ── Actions ──────────────────────────────────────────────────────────────
  startFast: (protocol: string, targetHours: number) => void;
  pauseFast: () => void;
  resumeFast: () => void;
  endFast: () => void;
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
  addRecentSuggestion: (foodName: string) => void;
  setCachedProfile: (profile: UserProfile | null) => void;
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

const FAST_STORAGE_KEY = 'fittrack_active_fast';
const SUGGESTION_KEY = 'fittrack_recent_suggestions';
const DIVERSITY_WINDOW = 10;

function loadActiveFast(): AppState['activeFast'] {
  try {
    const raw = localStorage.getItem(FAST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveActiveFast(fast: AppState['activeFast']) {
  if (fast) {
    localStorage.setItem(FAST_STORAGE_KEY, JSON.stringify(fast));
  } else {
    localStorage.removeItem(FAST_STORAGE_KEY);
  }
}

function loadRecentSuggestions(): string[] {
  try {
    const raw = localStorage.getItem(SUGGESTION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  activeFast: loadActiveFast(),
  toasts: [],
  recentSuggestions: loadRecentSuggestions(),
  cachedProfile: null,

  startFast: (protocol, targetHours) => {
    const fast = {
      isRunning: true,
      startedAt: new Date().toISOString(),
      targetHours,
      protocol,
      pausedAt: null,
      totalPausedMs: 0,
    };
    saveActiveFast(fast);
    set({ activeFast: fast });
  },

  pauseFast: () => {
    const { activeFast } = get();
    if (!activeFast || !activeFast.isRunning) return;
    const updated = {
      ...activeFast,
      isRunning: false,
      pausedAt: new Date().toISOString(),
    };
    saveActiveFast(updated);
    set({ activeFast: updated });
  },

  resumeFast: () => {
    const { activeFast } = get();
    if (!activeFast || activeFast.isRunning || !activeFast.pausedAt) return;
    const pausedMs = Date.now() - new Date(activeFast.pausedAt).getTime();
    const updated = {
      ...activeFast,
      isRunning: true,
      pausedAt: null,
      totalPausedMs: (activeFast.totalPausedMs || 0) + pausedMs,
    };
    saveActiveFast(updated);
    set({ activeFast: updated });
  },

  endFast: () => {
    saveActiveFast(null);
    set({ activeFast: null });
  },

  addToast: (message, type = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    // Auto-remove after 3.5s
    setTimeout(() => {
      get().removeToast(id);
    }, 3500);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  addRecentSuggestion: (foodName) => {
    const prev = get().recentSuggestions;
    const updated = [foodName, ...prev.filter((n) => n !== foodName)].slice(0, DIVERSITY_WINDOW);
    localStorage.setItem(SUGGESTION_KEY, JSON.stringify(updated));
    set({ recentSuggestions: updated });
  },

  setCachedProfile: (profile) => {
    set({ cachedProfile: profile });
  },
}));
