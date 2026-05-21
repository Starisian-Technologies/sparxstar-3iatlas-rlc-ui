import { useEffect, useRef, useState } from 'react'
import { useSessionPoll } from '@/hooks/useSessionPoll'
import { GRAMMAR_DOMAINS } from '@/types'

interface RscCompleteScreenProps {
  session_id: string
  onCollectionEnded: () => void
}

export function RscCompleteScreen({ session_id, onCollectionEnded }: RscCompleteScreenProps) {
  const hasCollectionEndedRef = useRef(false)
  const [pollingEnabled, setPollingEnabled] = useState(true)
  const { session } = useSessionPoll(session_id, pollingEnabled)

  useEffect(() => {
    const status = session?.status
    if (!hasCollectionEndedRef.current && (status === 'qc' || status === 'closed')) {
      hasCollectionEndedRef.current = true
      setPollingEnabled(false)
      onCollectionEnded()
    }
  }, [onCollectionEnded, session])

  return (
    <div style={wrapStyle}>
      <svg aria-hidden="true" width={48} height={48} viewBox="0 0 48 48" fill="none">
        <circle cx={24} cy={24} r={22} fill="var(--success)" opacity={0.15} />
        <circle cx={24} cy={24} r={22} stroke="var(--success)" strokeWidth={2} />
        <path d="M14 24l8 8 12-14" stroke="var(--success)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontSize: 22, fontWeight: 800 }}>You finished!</div>
      <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 6 }}>
        All {GRAMMAR_DOMAINS.length} sentences submitted. Waiting for the class…
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
