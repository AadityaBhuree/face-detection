'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface OfflineState {
  /** Whether the browser currently has network connectivity. */
  isOnline: boolean;
  /** Whether a background sync flush is in progress. */
  isSyncing: boolean;
  /** Number of intake mutations queued in the outbox awaiting sync. */
  pendingCount: number;
  /** ISO timestamp of the last successful sync, or null if never synced. */
  lastSyncedAt: string | null;
  /** Human-readable message from the last sync attempt (errors). */
  syncError: string | null;

  setOnline: (online: boolean) => void;
  setIsSyncing: (syncing: boolean) => void;
  setPendingCount: (count: number) => void;
  setLastSyncedAt: (iso: string | null) => void;
  setSyncError: (message: string | null) => void;
  reset: () => void;
}

const initialState = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
  syncError: null,
};

/**
 * Global connectivity + offline-sync state. Wired to the browser's
 * online/offline events by `initOfflineListeners()` (services/sync.ts).
 * UI reads this store to render the OfflineIndicator banner.
 */
export const useOfflineStore = create<OfflineState>()(
  devtools(
    (set) => ({
      ...initialState,

      setOnline: (online) => set({ isOnline: online }),

      setIsSyncing: (syncing) => set({ isSyncing: syncing }),

      setPendingCount: (count) => set({ pendingCount: count }),

      setLastSyncedAt: (iso) => set({ lastSyncedAt: iso }),

      setSyncError: (message) => set({ syncError: message }),

      reset: () => set(initialState),
    }),
    { name: 'offline-store' },
  ),
);
