'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { WifiOff, RefreshCw, CheckCircle2, CloudOff } from 'lucide-react';
import { flushPendingMutations } from '@/services/sync';

/**
 * Global offline banner — shows when the browser loses connectivity and
 * doubles as the sync status chip (queued count, syncing, last sync).
 * Mounted once in app Providers so it appears on every page.
 */
export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount, syncError } = useOnlineStatus();

  // Fully online with nothing pending → nothing to show
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 border-b px-4 py-2 text-xs font-medium shadow-sm backdrop-blur-md',
        isOnline
          ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/90 dark:text-emerald-300'
          : 'border-amber-200 bg-amber-50/95 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/90 dark:text-amber-300',
      )}
    >
      {isOnline ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {isSyncing ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Syncing {pendingCount} offline change{pendingCount !== 1 ? 's' : ''}…
            </>
          ) : (
            <>
              You&apos;re back online
              {pendingCount > 0 &&
                ` — ${pendingCount} queued change${pendingCount !== 1 ? 's' : ''}`}
            </>
          )}
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          You&apos;re offline
          {pendingCount > 0 && ` — ${pendingCount} change${pendingCount !== 1 ? 's' : ''} queued`}
          <button
            type="button"
            onClick={() => void flushPendingMutations()}
            disabled={isSyncing}
            className="ml-1 inline-flex items-center gap-1 rounded-full border border-current px-2 py-0.5 font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            <CloudOff className="h-3 w-3" aria-hidden="true" />
            {isSyncing ? 'Syncing…' : 'Retry sync'}
          </button>
        </>
      )}

      {syncError && isOnline && (
        <span className="ml-1 max-w-[50ch] truncate text-[11px] opacity-80">({syncError})</span>
      )}
    </div>
  );
}
