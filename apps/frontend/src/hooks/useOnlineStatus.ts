'use client';

import { useOfflineStore } from '@/stores/offline-store';

export interface OnlineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  syncError: string | null;
}

/**
 * Reactive connectivity + offline-sync status. Backed by the offline store,
 * which is kept in sync with the browser's online/offline events by
 * `initOfflineSync()` (services/sync.ts) — mounted once in app Providers.
 */
export function useOnlineStatus(): OnlineStatus {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const isSyncing = useOfflineStore((s) => s.isSyncing);
  const pendingCount = useOfflineStore((s) => s.pendingCount);
  const lastSyncedAt = useOfflineStore((s) => s.lastSyncedAt);
  const syncError = useOfflineStore((s) => s.syncError);

  return { isOnline, isSyncing, pendingCount, lastSyncedAt, syncError };
}
