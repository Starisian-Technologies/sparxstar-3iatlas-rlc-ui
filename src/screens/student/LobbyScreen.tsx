import { useMemo } from 'react'
import { useSessionPoll } from '@/hooks/useSessionPoll'
import { AiGuidePanel } from '@/components/AiGuidePanel'
import { ContinuityBanner } from '@/components/ContinuityBanner'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

const LEVEL_XP_REQUIREMENT = 1200
const MIN_PROGRESS_PERCENT = 8
const MAX_PROGRESS_PERCENT = 100

interface LobbyScreenProps {
  session_id: string
  display_name: string
  onEnterRound: () => void
}

export function LobbyScreen({ session_id, display_name, onEnterRound }: LobbyScreenProps) {
  const { session, error } = useSessionPoll(session_id, true)
  const { isOnline } = useNetworkStatus()
  const seconds = session?.next_round_starts_in_seconds ?? session?.time_remaining_seconds ?? 0
  const canEnterRound = session?.round_status === 'active'
  const currentRound = session?.current_round ?? 1
  const totalRounds = session?.total_rounds ?? 5

  const profile = useMemo(() => {
    const me = session?.leaderboard.find((entry) => entry.display_name === display_name)
    return {
      stars: me?.gold ?? 0,
      score: me?.xp ?? 0,
      rank: me?.rank ?? '-',
    }
  }, [display_name, session?.leaderboard])

  return (
    <div style={wrapStyle}>
      <header style={headerStyle}>
        <div style={logoStyle}>AiWA</div>
        <select style={langSelectStyle} defaultValue={session?.language ?? 'mandinka'} aria-label="Language selector">
          <option value="mandinka">Mandinka</option>
          <option value="wolof">Wolof</option>
          <option value="fula">Fula</option>
        </select>
      </header>

      <ContinuityBanner isOnline={isOnline} hasConnectionIssue={Boolean(error)} />

      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={avatarStyle}>👤</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{display_name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Word Explorer</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, color: 'var(--gold)' }}>⭐ {profile.stars}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{profile.score} pts</div>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionTitleStyle}>Play Game</div>
        <ActionCard title="Join a Game" subtitle="Play with a group" enabled onClick={onEnterRound} />
        <ActionCard title="Solo Mode" subtitle="Coming soon" />
        <ActionCard title="Practice" subtitle="Coming soon" />
      </section>

      <section style={cardStyle}>
        <div style={sectionTitleStyle}>Active Session</div>
        <div style={activeGridStyle}>
          <Metric label="Topic" value={(session?.semantic_domain_id ?? 'WATER SOURCES').toUpperCase()} />
          <Metric label="Mode" value={(session?.mode ?? 'rwc').toUpperCase()} />
          <Metric label="Round" value={`${currentRound}/${totalRounds}`} />
          <Metric label="Players" value={`${session?.participant_count ?? 0}`} />
          <Metric label="Words" value={`${session?.token_count ?? 0}`} />
          <Metric label="Starts in" value={`${String(Math.max(0, seconds)).padStart(2, '0')}s`} />
        </div>
        <button type="button" onClick={onEnterRound} disabled={!canEnterRound} style={primaryBtnStyle(!canEnterRound)}>
          {canEnterRound ? `Enter Round ${currentRound}` : 'Waiting for next round…'}
        </button>
      </section>

      <section style={cardStyle}>
        <div style={sectionTitleStyle}>Your Progress</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>Level 7 · Word Collector</div>
        <div style={progressTrackStyle}>
          <div
            style={{
              ...progressFillStyle,
              width: `${Math.min(
                MAX_PROGRESS_PERCENT,
                Math.max(MIN_PROGRESS_PERCENT, ((profile.score % LEVEL_XP_REQUIREMENT) / LEVEL_XP_REQUIREMENT) * 100),
              )}%`,
            }}
          />
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          Rank {profile.rank} of {session?.leaderboard.length ?? 0}
        </div>
      </section>

      <AiGuidePanel compact context={{ language: session?.language }} />

      <nav style={bottomNavStyle} aria-label="Bottom navigation">
        {['Lobby', 'Games', 'Progress', 'Awards', 'Profile'].map((item) => (
          <button key={item} type="button" style={navItemStyle} disabled={item !== 'Lobby'}>
            {item}
          </button>
        ))}
      </nav>
    </div>
  )
}

function ActionCard({ title, subtitle, onClick, enabled = false }: { title: string; subtitle: string; onClick?: () => void; enabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={!enabled} style={actionCardStyle(enabled)}>
      <span>{title}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{subtitle}</span>
    </button>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricStyle}>
      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{value}</div>
    </div>
  )
}

const wrapStyle: React.CSSProperties = {
  minHeight: '100dvh',
  padding: 16,
  background: 'var(--bg)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const logoStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}

const langSelectStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text-primary)',
  padding: '0 10px',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
}

const avatarStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  background: 'rgba(255,45,120,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const activeGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
}

const metricStyle: React.CSSProperties = {
  borderRadius: 10,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border)',
  minHeight: 58,
  padding: 8,
}

const actionCardStyle = (enabled: boolean): React.CSSProperties => ({
  minHeight: 56,
  borderRadius: 12,
  border: `1px solid ${enabled ? 'rgba(255,45,120,0.38)' : 'var(--border)'}`,
  background: enabled ? 'rgba(255,45,120,0.15)' : 'rgba(255,255,255,0.03)',
  color: 'var(--text-primary)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: 3,
  padding: '8px 12px',
  cursor: enabled ? 'pointer' : 'not-allowed',
})

const progressTrackStyle: React.CSSProperties = {
  width: '100%',
  height: 10,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.08)',
  overflow: 'hidden',
}

const progressFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
}

const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  minHeight: 48,
  width: '100%',
  borderRadius: 12,
  border: 'none',
  background: disabled ? 'rgba(255,255,255,0.15)' : 'var(--accent-primary)',
  color: 'var(--text-primary)',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const bottomNavStyle: React.CSSProperties = {
  marginTop: 'auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 6,
  borderRadius: 14,
  background: 'var(--card)',
  border: '1px solid var(--border)',
  padding: 8,
}

const navItemStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-primary)',
  fontSize: 12,
}
