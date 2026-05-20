import { useEffect, useRef } from 'react'
import { api } from '@/api/client'

const TOTAL_SENTENCES = 12
const STATUS_POLL_INTERVAL_MS = 3000

interface RscCompleteScreenProps {
  session_id: string
  onCollectionEnded: () => void
}

export function RscCompleteScreen({ session_id, onCollectionEnded }: RscCompleteScreenProps) {
  const callbackRef = useRef(onCollectionEnded)

  useEffect(() => {
    callbackRef.current = onCollectionEnded
  }, [onCollectionEnded])

  useEffect(() => {
    let active = true
    let hasEnded = false
    let timeout: ReturnType<typeof setTimeout> | null = null

    const scheduleNextPoll = () => {
      if (!active || hasEnded) return
      timeout = setTimeout(() => {
        void poll()
      }, STATUS_POLL_INTERVAL_MS)
    }

    const poll = async () => {
      if (!active || hasEnded) return
      try {
        const status = await api.session.status(session_id)
        if (!active || hasEnded) return
        if (status.status === 'qc' || status.status === 'closed') {
          hasEnded = true
          active = false
          callbackRef.current()
          return
        }
      } catch {
        // transient error — keep polling
      }

      scheduleNextPoll()
    }

    void poll()

    return () => {
      active = false
      if (timeout) clearTimeout(timeout)
    }
  }, [session_id])

  return (
    <div style={wrapStyle}>
      <div aria-hidden="true" style={{ fontSize: 48 }}>
        ✅
      </div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>You finished!</div>
      <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 6 }}>
        All {TOTAL_SENTENCES} sentences submitted. Waiting for the class…
      </div>
      <div style={pulseWrapStyle}>
        <div style={pulseStyle} />
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          The teacher will start the review when everyone is ready
        </div>
      </div>
    </div>
  )
}

const wrapStyle: React.CSSProperties = {
  minHeight: '100dvh',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  padding: 24,
  textAlign: 'center',
}

const pulseWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  marginTop: 8,
}

const pulseStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: '50%',
  background: 'var(--accent-primary)',
  animation: 'spx-sync-pulse 1.4s ease-in-out infinite',
}
