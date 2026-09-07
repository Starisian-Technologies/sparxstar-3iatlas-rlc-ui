/**
 * Persistent sync status indicator — spec §6.3 (UI Overlay Rules v2.1).
 *
 * Shown in the header of every student screen. Three states:
 *   synced  — cloud icon (green)  — connected, queue empty
 *   syncing — animated upload icon — flushing queued submissions
 *   offline — no-connection icon   — sync unavailable (offline or latest sync failed)
 *
 * Badge shows pending count when > 0. Badge clears when server confirms receipt.
 */

import { useTranslation } from 'react-i18next'
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

/**
 * This indicator has no visible text — the icon is `aria-hidden`, so the label
 * IS the component for anyone using a screen reader. It is translated for the
 * same reason the visible strings are.
 */
const ARIA_LABELS: Record<SyncState, { key: string; en: string }> = {
  synced:  { key: 'sync.synced',  en: 'Synced' },
  offline: { key: 'sync.offline', en: 'Offline — sync unavailable' },
  syncing: { key: 'sync.syncing', en: 'Syncing…' },
}

export function SyncStatusIndicator({
  syncState,
  pendingCount,
  style,
}: SyncStatusIndicatorProps) {
  const { t } = useTranslation()
  const isSyncing = syncState === 'syncing'
  const label = ARIA_LABELS[syncState]

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t(label.key, { defaultValue: label.en })}
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
