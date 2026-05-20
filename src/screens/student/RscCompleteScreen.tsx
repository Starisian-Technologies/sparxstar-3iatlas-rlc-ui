import { useEffect, useRef } from 'react'
import { useSessionPoll } from '@/hooks/useSessionPoll'

interface RscCompleteScreenProps {
  session_id: string
  onCollectionEnded: () => void
}

export function RscCompleteScreen({ session_id, onCollectionEnded }: RscCompleteScreenProps) {
  const hasCollectionEndedRef = useRef(false)
  const { session } = useSessionPoll(session_id, !hasCollectionEndedRef.current)

  useEffect(() => {
    const status = session?.status
    if (!hasCollectionEndedRef.current && (status === 'qc' || status === 'closed')) {
      hasCollectionEndedRef.current = true
      onCollectionEnded()
    }
  }, [onCollectionEnded, session?.status])

  return (
    <div style={wrapStyle}>
      <div aria-hidden="true" style={{ fontSize: 48 }}>
        ✅
      </div>
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
