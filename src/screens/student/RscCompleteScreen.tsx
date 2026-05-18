import { useEffect, useRef } from 'react'
import { api } from '@/api/client'

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

    const poll = async () => {
      try {
        const status = await api.session.status(session_id)
        if (!active) return
        if (status.status === 'qc' || status.status === 'closed') {
          callbackRef.current()
        }
      } catch {
        // transient error — keep polling
      }
    }

    void poll()
    const interval = setInterval(() => void poll(), 3000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [session_id])

  return (
    <div style={wrapStyle}>
      <div style={{ fontSize: 48 }}>✅</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>You finished!</div>
      <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 6 }}>
        All 12 sentences submitted. Waiting for the class…
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
