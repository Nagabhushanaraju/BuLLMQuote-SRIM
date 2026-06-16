/**
 * Global daemon connection state.
 *
 * Tracks whether the daemon at http://127.0.0.1:9234 is reachable.
 * Polls GET /health every 5 seconds — no Electron IPC needed.
 */

import { create } from 'zustand';

import { BACKEND_URL } from '../config/endpoints';

export type DaemonStatus =
  | 'connected'
  | 'starting'
  | 'stopping'
  | 'stopped'
  | 'disconnected'
  | 'reconnecting'
  | 'reconnect-failed';

interface DaemonState {
  status: DaemonStatus;
  toastDismissed: boolean;
  setStatus: (status: DaemonStatus) => void;
  dismissToast: () => void;
}

export const useDaemonStore = create<DaemonState>((set) => ({
  status: 'connected',
  toastDismissed: false,
  setStatus: (status) => {
    set({
      status,
      ...(status === 'disconnected' || status === 'reconnect-failed'
        ? { toastDismissed: false }
        : {}),
    });
  },
  dismissToast: () => {
    set({ toastDismissed: true });
  },
}));

// Centralized backend address — see config/endpoints.ts.
const BRIDGE = BACKEND_URL;

async function checkHealth(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      ctrl.abort();
    }, 3000);
    try {
      const r = await fetch(`${BRIDGE}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      useDaemonStore.getState().setStatus(r.ok ? 'connected' : 'disconnected');
    } catch {
      clearTimeout(t);
      useDaemonStore.getState().setStatus('disconnected');
    }
  } catch {
    useDaemonStore.getState().setStatus('disconnected');
  }
}

if (typeof window !== 'undefined') {
  void checkHealth();
  setInterval(() => {
    void checkHealth();
  }, 5000);
}
