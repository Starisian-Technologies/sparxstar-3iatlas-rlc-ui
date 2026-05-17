/**
 * Persistent sync status indicator — spec §6.3 (UI Overlay Rules v2.1).
 *
 * Shown in the header of every student screen. Three states:
 *   synced  — cloud icon (green)  — connected, queue empty
 *   syncing — animated upload icon — flushing queued submissions
 *   offline — no-connection icon   — device disconnected
 *
 * Badge shows pending count when > 0. Badge clears when server confirms receipt.
 */

import type { SyncState } from '@/hooks/useSubmissionQueue'

interface SyncStatusIndicatorProps {
  syncState:    SyncState
  pendingCount: number
  style?:       React.CSSProperties
}

const ICONS: Record<SyncState, string> = {
  synced:  '☁',
  offline: '⚡',
  syncing: '↑',
}

const COLORS: Record<SyncState, string> = {
  synced:  '#22c55e',   // green
  offline: '#9B8EC4',   // muted purple
  syncing: '#F59E0B',   // amber
}

const ARIA_LABELS: Record<SyncState, string> = {
  synced:  'Synced',
  offline: 'Offline — submissions queued',
  syncing: 'Syncing…',
}

export function SyncStatusIndicator({
  syncState,
  pendingCount,
  style,
}: SyncStatusIndicatorProps) {
  const isSyncing = syncState === 'syncing'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ARIA_LABELS[syncState]}
      style={{
        minHeight: 44,
        minWidth:  44,
        borderRadius: 999,
        background: 'var(--card)',
        border: `1px solid ${COLORS[syncState]}44`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '0 10px',
        position: 'relative',
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: 16,
          color: COLORS[syncState],
          animation: isSyncing ? 'spx-sync-pulse 1s ease-in-out infinite' : undefined,
        }}
      >
        {ICONS[syncState]}
      </span>

      {pendingCount > 0 && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: COLORS[syncState],
          }}
        >
          {pendingCount}
        </span>
      )}
    </div>
  )
}
