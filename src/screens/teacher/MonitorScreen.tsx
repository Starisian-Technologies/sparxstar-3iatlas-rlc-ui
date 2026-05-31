import { useEffect, useMemo, useState } from 'react'
import { useSessionSocket } from '@/hooks/useSessionSocket'
import { createSocket } from '@/runtime/socket'
import { AiGuidePanel } from '@/components/AiGuidePanel'
import { ContinuityBanner } from '@/components/ContinuityBanner'
import { Avatar } from '@/components/Avatar'
import { StarBadge } from '@/components/StarBadge'
import { TenantLogo } from '@/components/TenantLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useTheme } from '@/theme/useTheme'
interface TokenSubmittedEvent {
  participant_id: string
  completeness_signal: string
  account_lifetime_xp: number
}

function getTeacherToken(): string | null {
  const fromWindow = (window as unknown as Record<string, unknown>)['RLC_TEACHER_TOKEN']
  if (typeof fromWindow === 'string' && fromWindow.length > 0) return fromWindow
  try { return localStorage.getItem('RLC_TEACHER_TOKEN') } catch { return null }
}

interface MonitorScreenProps {
  session_id: string
  join_code: string
  onEndCollection: () => void
}

export function MonitorScreen({ session_id, join_code, onEndCollection }: MonitorScreenProps) {
  const { tokens } = useTheme()
  const teacherToken = useMemo(() => getTeacherToken(), [])
  const auth = useMemo(
    () => teacherToken ? { role: 'teacher' as const, token: teacherToken, sessionId: session_id } : null,
    [teacherToken, session_id],
  )
  const { session, error } = useSessionSocket(session_id, true, { auth })
  const { isOnline } = useNetworkStatus()
  const [liveFeed, setLiveFeed] = useState<(TokenSubmittedEvent & { id: string })[]>([])

  // Live feed via socket token:submitted events
  useEffect(() => {
    if (!teacherToken) return
    const socket = createSocket({ role: 'teacher', token: teacherToken, sessionId: session_id })

    socket.on('token:submitted', (ev: TokenSubmittedEvent) => {
      setLiveFeed((prev) => [
        { ...ev, id: `${ev.participant_id}-${Date.now()}-${Math.random()}` },
        ...prev,
      ].slice(0, 8))
    })

    return () => { socket.disconnect() }
  }, [session_id, teacherToken])

  const minutes = Math.floor((session?.time_remaining_seconds ?? 0) / 60)
  const seconds = (session?.time_remaining_seconds ?? 0) % 60
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div style={wrapStyle}>
      {/* ── Tenant header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <TenantLogo size="medium" />
        <ThemeToggle />
      </div>

      {/* ── Join-code hero ── */}
      <section style={joinCodeHeroStyle}>
        <div>
          <div style={{ color: tokens.textMuted, fontSize: 12, letterSpacing: 1, fontWeight: 700 }}>JOIN CODE</div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: tokens.primary,
              letterSpacing: 6,
              fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
              lineHeight: 1.1,
            }}
          >
            {join_code}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: tokens.textMuted, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{timeDisplay}</div>
        </div>
      </section>

      <ContinuityBanner isOnline={isOnline} hasConnectionIssue={Boolean(error)} />

      {/* ── Stats row ── */}
      <div style={statsRowStyle}>
        <StatChip label="Players" value={String(session?.participant_count ?? 0)} />
        <StatChip label="Words" value={String(session?.token_count ?? 0)} />
        <StatChip label="Status" value={session?.status === 'open' ? 'In progress' : (session?.status ?? '—')} />
      </div>

      {/* ── Main two-column body ── */}
      <div style={bodyStyle}>
        {/* Live Word Feed */}
        <section style={panelStyle}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Live Word Feed</div>
          {liveFeed.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Waiting for submissions…</div>
          )}
          {liveFeed.map((ev) => (
            <div key={ev.id} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: tokens.text }}>{ev.participant_id}</div>
                <div style={{ color: tokens.textMuted, fontSize: 12 }}>{ev.completeness_signal}</div>
              </div>
              <StarBadge variant="gold" count={`+${ev.account_lifetime_xp}`} size={14} label={`${ev.account_lifetime_xp} XP`} />
            </div>
          ))}
        </section>

        {/* Leaderboard */}
        <section style={panelStyle}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Players</div>
          {(session?.leaderboard ?? []).slice(0, 8).map((entry) => (
            <div key={entry.participant_id} style={rowStyle}>
              <span style={{ minWidth: 22, color: tokens.textMuted, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{entry.rank}</span>
              <Avatar seed={entry.display_name} size={28} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.display_name}</span>
              <StarBadge variant="gold" count={entry.xp} size={13} label={`${entry.xp} XP`} />
            </div>
          ))}
          {(session?.leaderboard ?? []).length === 0 && (
            <div style={{ color: tokens.textMuted, fontSize: 13 }}>No players yet — waiting for joins.</div>
          )}
        </section>
      </div>

      <AiGuidePanel compact context={{ language: session?.language, mode: session?.mode }} />

      {error && <div style={errorStyle}>Connection issue — retrying.</div>}

      {/* ── Teacher action buttons ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
        <button type="button" onClick={onEndCollection} style={endBtnStyle}>
          End collection &amp; start QC
        </button>
      </div>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme()
  return (
    <div style={{
      flex: 1, background: tokens.card, border: `1px solid ${tokens.border}`,
      borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 2, minHeight: 60,
    }}>
      <div style={{ fontWeight: 900, fontSize: 22, color: tokens.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ color: tokens.textMuted, fontSize: 11, letterSpacing: 0.3 }}>{label}</div>
    </div>
  )
}

const joinCodeHeroStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--primary-soft)',
  background: 'var(--card)',
  padding: 16,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
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
