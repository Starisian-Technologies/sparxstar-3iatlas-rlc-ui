import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { useSessionPoll } from '@/hooks/useSessionPoll'
import { AiGuidePanel } from '@/components/AiGuidePanel'
import type { QcToken } from '@/types'

interface MonitorScreenProps {
  session_id: string
  join_code: string
  onEndCollection: () => void
}

export function MonitorScreen({ session_id, join_code, onEndCollection }: MonitorScreenProps) {
  const { session, error } = useSessionPoll(session_id, true)
  const [liveFeed, setLiveFeed] = useState<QcToken[]>([])

  useEffect(() => {
    let mounted = true
    const loadFeed = async () => {
      try {
        const words = await api.session.qcWords(session_id)
        if (!mounted) return
        setLiveFeed(words.slice(-8).reverse())
      } catch {
        // No-op; session polling state already handles network messaging.
      }
    }
    void loadFeed()
    const interval = setInterval(() => void loadFeed(), 2000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [session_id])

  return (
    <div style={wrapStyle}>
      <header style={headerStyle}>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Game Lobby</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>Code: {join_code}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
            Round {session?.current_round ?? 1}/{session?.total_rounds ?? 5}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {session?.participant_count ?? 0} players · {session?.token_count ?? 0} words
          </div>
        </div>
      </header>

      <section style={panelStyle}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Live leaderboard</div>
        {(session?.leaderboard ?? []).slice(0, 8).map((entry) => (
          <div key={entry.participant_id} style={rowStyle}>
            <span style={{ minWidth: 24, color: 'var(--text-secondary)' }}>{entry.rank}</span>
            <span style={{ flex: 1 }}>{entry.display_name}</span>
            <span style={{ color: 'var(--gold)' }}>{entry.xp} ⭐</span>
          </div>
        ))}
      </section>

      <section style={panelStyle}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Live Word Feed</div>
        {liveFeed.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Waiting for submissions…</div>
        )}
        {liveFeed.map((token) => (
          <div key={token.token_id} style={rowStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{token.text}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{token.translation ?? 'No translation'}</div>
            </div>
            <span style={{ color: 'var(--gold)' }}>+{token.xp_awarded ?? 10}</span>
          </div>
        ))}
      </section>

      <AiGuidePanel compact />

      {error && <div style={errorStyle}>Connection issue — retrying every 2 seconds.</div>}
      <button type="button" onClick={onEndCollection} style={endBtnStyle}>End Round / Start QC</button>
    </div>
  )
}

const wrapStyle: React.CSSProperties = {
  minHeight: '100dvh',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const headerStyle: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  padding: 14,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
}

const panelStyle: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const rowStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.03)',
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const endBtnStyle: React.CSSProperties = {
  minHeight: 52,
  borderRadius: 12,
  border: 'none',
  background: 'var(--accent-primary)',
  color: 'var(--text-primary)',
  fontSize: 17,
  fontWeight: 700,
  cursor: 'pointer',
}

const errorStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 10,
  border: '1px solid rgba(239,68,68,0.5)',
  background: 'rgba(239,68,68,0.1)',
  color: '#fecaca',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  fontSize: 14,
}
