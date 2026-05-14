import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { useSessionPoll } from '@/hooks/useSessionPoll'
import { AiGuidePanel } from '@/components/AiGuidePanel'
import { ContinuityBanner } from '@/components/ContinuityBanner'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import type { QcToken } from '@/types'

interface MonitorScreenProps {
  session_id: string
  join_code: string
  onEndCollection: () => void
  onNextRound?: () => void
}

export function MonitorScreen({ session_id, join_code, onEndCollection, onNextRound }: MonitorScreenProps) {
  const { session, error } = useSessionPoll(session_id, true)
  const { isOnline } = useNetworkStatus()
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

  const round = session?.current_round ?? 1
  const totalRounds = session?.total_rounds ?? 5
  const minutes = Math.floor((session?.time_remaining_seconds ?? 0) / 60)
  const seconds = (session?.time_remaining_seconds ?? 0) % 60
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div style={wrapStyle}>
      {/* ── Header ── */}
      <header style={headerStyle}>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, letterSpacing: 1 }}>GAME LOBBY</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            Game Code: <span style={{ color: 'var(--accent-primary)' }}>{join_code}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: 16 }}>
            Round {round}/{totalRounds}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>⏱ {timeDisplay}</div>
        </div>
      </header>

      <ContinuityBanner isOnline={isOnline} hasConnectionIssue={Boolean(error)} />

      {/* ── Stats row ── */}
      <div style={statsRowStyle}>
        <StatChip label="Players" value={String(session?.participant_count ?? 0)} icon="👥" />
        <StatChip label="Words" value={String(session?.token_count ?? 0)} icon="💬" />
        <StatChip label="Status" value={session?.status === 'open' ? 'In Progress' : (session?.status ?? '—')} icon="📍" />
      </div>

      {/* ── Main two-column body ── */}
      <div style={bodyStyle}>
        {/* Live Word Feed */}
        <section style={panelStyle}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Live Word Feed</div>
          {liveFeed.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Waiting for submissions…</div>
          )}
          {liveFeed.map((token) => (
            <div key={token.token_id} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{token.text}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{token.translation ?? 'No translation'}</div>
              </div>
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>+{token.xp_awarded ?? 10} ⭐</span>
            </div>
          ))}
        </section>

        {/* Leaderboard */}
        <section style={panelStyle}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Players</div>
          {(session?.leaderboard ?? []).slice(0, 8).map((entry) => (
            <div key={entry.participant_id} style={rowStyle}>
              <span style={{ minWidth: 22, color: 'var(--text-secondary)' }}>{entry.rank}</span>
              <span style={{ flex: 1 }}>{entry.display_name}</span>
              <span style={{ color: 'var(--gold)' }}>{entry.xp} ⭐</span>
            </div>
          ))}
        </section>
      </div>

      <AiGuidePanel compact context={{ language: session?.language, mode: session?.mode }} />

      {error && <div style={errorStyle}>Connection issue — retrying.</div>}

      {/* ── Teacher action buttons ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {onNextRound && (
          <button
            type="button"
            onClick={onNextRound}
            aria-label="Start next round"
            style={nextRoundBtnStyle}
          >
            Next Round
          </button>
        )}
        <button type="button" onClick={onEndCollection} style={endBtnStyle}>
          End Game / Start QC
        </button>
      </div>
    </div>
  )
}

function StatChip({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div style={{
      flex: 1, background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 2,
    }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{label}</div>
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

const statsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
}

const bodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
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

const nextRoundBtnStyle: React.CSSProperties = {
  minHeight: 52,
  borderRadius: 12,
  border: 'none',
  background: 'var(--accent-secondary)',
  color: 'var(--text-primary)',
  fontSize: 17,
  fontWeight: 700,
  cursor: 'pointer',
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
