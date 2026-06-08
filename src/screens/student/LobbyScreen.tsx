/**
 * Student lobby — the room a student lands in after joining.
 *
 * Shows: who you are (avatar + screen name), the active session at a glance
 * (topic / mode / round / players / words / countdown), and the primary CTA
 * to enter the round when the teacher opens one.
 *
 * Real-time updates currently come from `useSessionPoll`. The Socket
 * Introduction migration step replaces the poll with socket.io events
 * without touching this file's UI surface.
 */
import { useMemo } from 'react'
import { useSessionSocket } from '@/hooks/useSessionSocket'
import { ContinuityBanner } from '@/components/ContinuityBanner'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Avatar } from '@/components/Avatar'
import { XpBar } from '@/components/XpBar'
import { TenantLogo } from '@/components/TenantLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/theme/useTheme'

const LEVEL_XP_REQUIREMENT = 1200

interface LobbyScreenProps {
  session_id: string
  display_name: string
  participant_token: string | null
  onEnterRound: () => void
}

export function LobbyScreen({ session_id, display_name, participant_token, onEnterRound }: LobbyScreenProps) {
  const { tokens } = useTheme()
  const auth = useMemo(
    () => participant_token ? { token: participant_token } : null,
    [participant_token],
  )
  const { session, error } = useSessionSocket(session_id, true, { auth })
  const { isOnline } = useNetworkStatus()
  const seconds = session?.time_remaining_seconds ?? 0
  const canEnter = session?.status === 'open'

  const profile = useMemo(() => {
    const me = session?.leaderboard.find((entry) => entry.display_name === display_name)
    return {
      score: me?.xp ?? 0,
      rank: me?.rank ?? null,
    }
  }, [display_name, session?.leaderboard])

  const topic = (session?.semantic_domain_id ?? 'Loading…').toUpperCase()
  const playerCount = session?.participant_count ?? 0
  const wordCount = session?.token_count ?? 0

  return (
    <Screen
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <TenantLogo size="medium" />
          <ThemeToggle />
        </div>
      }
      footer={
        <Button onClick={onEnterRound} disabled={!canEnter} large>
          {canEnter ? 'Start collecting' : 'Waiting for teacher to open session…'}
        </Button>
      }
    >
      <ContinuityBanner isOnline={isOnline} hasConnectionIssue={Boolean(error)} />

      {/* Player card — avatar, name, XP */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar seed={display_name} size={56} highlight />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: tokens.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {display_name}
            </div>
            <div style={{ color: tokens.textMuted, fontSize: 13 }}>Word Collector</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <div style={{ color: tokens.text, fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
              {profile.score} XP
            </div>
          </div>
        </div>
      </Card>

      {/* Session summary */}
      <Card highlight>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: tokens.textMuted, letterSpacing: 1, fontWeight: 700 }}>TODAY&rsquo;S TOPIC</div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: tokens.primary, marginBottom: 12, lineHeight: 1.1 }}>
          {topic}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
          <Stat label="Players" value={`${playerCount}`} />
          <Stat label="Words" value={`${wordCount}`} />
          <Stat label="Time left" value={`${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`} />
        </div>
      </Card>

      {/* Player progress */}
      <Card>
        <XpBar
          current={profile.score % LEVEL_XP_REQUIREMENT}
          target={LEVEL_XP_REQUIREMENT}
          level={Math.floor(profile.score / LEVEL_XP_REQUIREMENT) + 1}
          title="Word Collector"
        />
        {profile.rank !== null && (
          <div style={{ marginTop: 10, fontSize: 13, color: tokens.textMuted }}>
            Currently rank{' '}
            <span style={{ color: tokens.text, fontWeight: 700 }}>#{profile.rank}</span>
            {' '}of {session?.leaderboard.length ?? 0}
          </div>
        )}
      </Card>
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme()
  return (
    <div
      style={{
        background: tokens.bg,
        border: `1px solid ${tokens.border}`,
        borderRadius: 10,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minHeight: 56,
      }}
    >
      <div style={{ color: tokens.textMuted, fontSize: 11, letterSpacing: 0.4 }}>{label}</div>
      <div style={{ color: tokens.text, fontWeight: 800, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}
