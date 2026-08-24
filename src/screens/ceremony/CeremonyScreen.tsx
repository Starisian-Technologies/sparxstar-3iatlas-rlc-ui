/**
 * CeremonyScreen — the closing celebration of a session.
 *
 * Three beats:
 *   1. Podium (top 3) with Adinkra avatars + crown for first place.
 *   2. Stars reveal one-by-one (2s cadence) so each award lands its own
 *      attention, not a wall of text.
 *   3. Final leaderboard + return button once all stars have landed.
 *
 * Fireworks only fire once at the end of the reveal so we don't pin a
 * 2014-era GPU for the full screen lifetime.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Fireworks } from '@/components/Fireworks'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Avatar } from '@/components/Avatar'
import { StarBadge, type StarVariant } from '@/components/StarBadge'
import { TenantLogo } from '@/components/TenantLogo'
import { useTheme } from '@/theme/useTheme'
import { emitRuntimeEvent } from '@/runtime/events'
import { useCeremony } from '@/hooks/useCeremony'
import type { SocketAuth } from '@/runtime/socket'
import type { AwardsResponse, LeaderboardEntry, Star, StarKind } from '@/types'

interface CeremonyScreenProps {
  session_id: string
  onReturnToSession: () => void
  /** Socket credential — how this screen receives the server-ordered reveal. */
  auth?: SocketAuth | null
  /** True when the session was already closed on arrival (a late joiner). */
  alreadyComplete?: boolean
  /**
   * Milliseconds between star reveals. Presentation only — it paces the
   * animation and cannot decide that the ceremony is over, which is
   * `ceremony:end`'s job alone. Explicit here rather than a buried constant so
   * the cadence is visible at the call site and adjustable per context.
   */
  revealIntervalMs?: number
}

/**
 * There is deliberately no star order here any more.
 *
 * This file used to carry a hardcoded `STAR_ORDER` and sort the awards against
 * it. That is the server's call — the order comes from the game manifest and
 * arrives as `seq` on each `ceremony:star` — and duplicating it client-side
 * meant two places to change and two chances to disagree.
 */

const STAR_REVEAL_INTERVAL_MS = 2000
const FIREWORKS_DURATION_MS = 4500

function variantForCategory(category: StarKind): StarVariant {
  switch (category) {
    case 'most_words':     return 'crown'
    case 'most_sentences': return 'crown'
    case 'best_spelling':  return 'perfect'
    case 'discovery':      return 'discovery'
    case 'speed':          return 'lightning'
    case 'audio':          return 'golden'
    case 'teacher':        return 'elder'
    case 'teacher_award':  return 'helping'
    default:               return 'gold'
  }
}

/** Star labels live in i18n (ceremony.stars.<kind>); the StarKind union maps 1:1. */

/** Map the wire awards leaderboard ({participant_id, screen_name, tokens, session_xp})
 *  to the UI LeaderboardEntry shape with derived rank. */
function awardsLeaderboardToUi(
  rows: AwardsResponse['leaderboard'],
): LeaderboardEntry[] {
  return rows.map((row, idx) => ({
    participant_id: row.participant_id,
    display_name: row.screen_name,
    xp: row.session_xp,
    rank: idx + 1,
  }))
}

export function CeremonyScreen({
  session_id,
  onReturnToSession,
  auth,
  alreadyComplete,
  revealIntervalMs = STAR_REVEAL_INTERVAL_MS
}: CeremonyScreenProps) {
  const { tokens, resolved } = useTheme()
  const [showFireworks, setShowFireworks] = useState(false)

  /**
   * The server owns the ceremony. `stars` arrive in the order the engine emitted
   * them and `finished` comes from `ceremony:end` — not from a local timer, and
   * not from counting what happened to arrive. The old implementation did both,
   * which is why every browser ran its own ceremony.
   */
  const { stars: orderedStars, awards, total, finished, hydratedFromRest, loading, error } = useCeremony(
    session_id,
    { auth, alreadyComplete }
  )

  /**
   * How many stars are currently shown.
   *
   * The animation still staggers the reveal — that is presentation, and it is
   * allowed. What changed is that it can only ever catch up to stars the SERVER
   * has already sent, and it cannot decide the ceremony is over. A star that has
   * not arrived cannot be revealed by a timer.
   */
  const [revealedCount, setRevealedCount] = useState(0)

  useEffect(() => {
    // A ceremony reconstructed from REST (this client arrived after the run) has
    // no live moment to pace, so show it whole rather than animating history.
    if (hydratedFromRest) {
      setRevealedCount(orderedStars.length)
      return
    }
    if (revealedCount >= orderedStars.length) return
    const timer = setTimeout(
      () => setRevealedCount((n) => Math.min(n + 1, orderedStars.length)),
      revealIntervalMs
    )
    return () => clearTimeout(timer)
  }, [orderedStars.length, revealedCount, hydratedFromRest, revealIntervalMs])

  const uiLeaderboard = useMemo(
    () => (awards ? awardsLeaderboardToUi(awards.leaderboard) : []),
    [awards],
  )

  const top3 = useMemo((): LeaderboardEntry[] => {
    return uiLeaderboard.slice(0, 3)
  }, [uiLeaderboard])

  useEffect(() => {
    if (revealedCount <= 0) return
    const revealedStar = orderedStars[revealedCount - 1]
    if (!revealedStar) return
    emitRuntimeEvent('AWARD_REVEALED', {
      sessionId: session_id,
      screen: 'ceremony',
      metadata: {
        category: revealedStar.star,
        participantIds: revealedStar.participant_ids,
        screenNames: revealedStar.screen_names,
      },
    })
  }, [orderedStars, revealedCount, session_id])

  useEffect(() => {
    // Gated on the authoritative end, not on "we have run out of stars to
    // show" — which was true for a moment every time the list was still filling.
    if (!finished) return
    if (revealedCount < orderedStars.length) return
    setShowFireworks(true)
    const timeout = setTimeout(() => setShowFireworks(false), FIREWORKS_DURATION_MS)
    return () => clearTimeout(timeout)
  }, [finished, orderedStars.length, revealedCount])

  if (loading) {
    return (
      <Screen centered>
        <div style={{ textAlign: 'center', color: tokens.textMuted }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: tokens.text, marginBottom: 6 }}>Loading ceremony…</div>
          <div style={{ fontSize: 14 }}>Gathering class results.</div>
        </div>
      </Screen>
    )
  }
  if (!awards) {
    return (
      <Screen centered>
        <div style={{ textAlign: 'center', color: tokens.textMuted }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: tokens.text, marginBottom: 6 }}>Ceremony unavailable</div>
          <div style={{ fontSize: 14 }}>{error ?? 'No awards data received.'}</div>
        </div>
      </Screen>
    )
  }

  const revealedStars = orderedStars.slice(0, revealedCount)
  /**
   * Done when the SERVER has ended the run and every star it sent is on screen.
   * `total` is the run length the server declared, so a client that missed a star
   * does not offer the exit early as though it had seen the whole ceremony.
   */
  /**
   * Only NUMBERED stars count toward the server's declared run length.
   *
   * `orderedStars` also contains out-of-sequence announcements (`seq: null`) — the
   * immediate Teacher's Star acknowledgement. Counting those against `total` let
   * one of them stand in for a dropped run star, so a client that missed an award
   * could still reach `total` and offer the exit as though it had seen the whole
   * ceremony.
   */
  const numberedRevealed = orderedStars.filter((s) => s.seq !== null).length
  const starsDone =
    finished && revealedCount >= orderedStars.length && (total === null || numberedRevealed >= total)

  return (
    <Screen
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TenantLogo size="medium" />
        </div>
      }
      footer={starsDone ? <Button onClick={onReturnToSession} large>Return to session</Button> : undefined}
    >
      {showFireworks && <Fireworks />}

      {/* Hero header */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
        <div style={{ fontSize: 13, letterSpacing: 3, color: tokens.primary, fontWeight: 800 }}>
          AWARDS CEREMONY
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: tokens.text,
            letterSpacing: -0.5,
            textShadow: resolved === 'dark' ? `0 0 24px ${tokens.glow}` : 'none',
          }}
        >
          Great game!
        </div>
        <div style={{ color: tokens.textMuted, fontSize: 15 }}>Here are your champions</div>
      </div>

      {/* Podium top-3 */}
      {top3.length > 0 && <Podium top3={top3} />}

      {/* Session stats */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <StatChip label="Words" value={String(awards.total_tokens)} />
          <StatChip label="New discoveries" value={String(awards.discovery_count)} variant="discovery" />
          <StatChip label="Players" value={String(uiLeaderboard.length)} />
        </div>
      </Card>

      {/* Star announcements */}
      {revealedStars.length > 0 && (
        <Card>
          <div style={{ fontSize: 16, fontWeight: 800, color: tokens.text, marginBottom: 8 }}>Award announcements</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {revealedStars.map((star) => (
              <StarRow key={`${star.star}-${star.participant_ids[0] ?? 'none'}`} star={star} />
            ))}
          </div>
        </Card>
      )}

      {/* Final leaderboard */}
      {starsDone && uiLeaderboard.length > 0 && (
        <Card>
          <div style={{ fontSize: 16, fontWeight: 800, color: tokens.text, marginBottom: 8 }}>Final leaderboard</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {uiLeaderboard.map((entry) => (
              <LeaderRow key={entry.participant_id} entry={entry} />
            ))}
          </div>
        </Card>
      )}
    </Screen>
  )
}

function Podium({ top3 }: { top3: LeaderboardEntry[] }) {
  const { tokens } = useTheme()
  const first = top3.find((e) => e.rank === 1)
  const second = top3.find((e) => e.rank === 2)
  const third = top3.find((e) => e.rank === 3)

  return (
    <Card highlight pad={20}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12 }}>
        {second && <PodiumBlock entry={second} height={88} barColor={tokens.starSilver} />}
        {first && <PodiumBlock entry={first} height={120} barColor={tokens.primary} crown />}
        {third && <PodiumBlock entry={third} height={68} barColor={tokens.starBronze} />}
      </div>
    </Card>
  )
}

function PodiumBlock({
  entry,
  height,
  barColor,
  crown = false,
}: {
  entry: LeaderboardEntry
  height: number
  barColor: string
  crown?: boolean
}) {
  const { tokens, resolved } = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, maxWidth: 120 }}>
      {crown && (
        <svg width={28} height={20} viewBox="0 0 24 18" aria-label="First place" role="img">
          <path d="M2 16h20l-2-12-5 5-5-7-5 7-5-5L2 16z" fill={tokens.starCrown} />
        </svg>
      )}
      <Avatar seed={entry.display_name} size={crown ? 64 : 52} highlight={crown} />
      <div
        style={{
          fontWeight: crown ? 800 : 700,
          fontSize: crown ? 14 : 13,
          textAlign: 'center',
          color: tokens.text,
          maxWidth: 110,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        {entry.display_name}
      </div>
      <StarBadge variant="gold" count={entry.xp} size={14} label={`${entry.xp} XP`} />
      <div
        style={{
          width: '100%',
          height,
          borderRadius: '10px 10px 0 0',
          background: barColor,
          opacity: resolved === 'dark' ? 0.85 : 1,
          boxShadow: resolved === 'dark' && crown ? `0 -8px 32px ${tokens.glow}` : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: tokens.textInverse,
          fontWeight: 900,
          fontSize: crown ? 24 : 18,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {entry.rank}
      </div>
    </div>
  )
}

function StarRow({ star }: { star: Star }) {
  const { tokens } = useTheme()
  const { t } = useTranslation()
  const variant = variantForCategory(star.star)
  const featured = star.screen_names[0] ?? '—'
  const extraCount = star.screen_names.length - 1
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: tokens.bg,
        border: `1px solid ${tokens.border}`,
        borderRadius: 12,
      }}
    >
      <Avatar seed={featured} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: tokens.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          {t(`ceremony.stars.${star.star}`, { defaultValue: star.star })}
        </div>
        <div style={{ fontWeight: 800, fontSize: 17, color: tokens.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {featured}{extraCount > 0 ? t('ceremony.stars.extra_winners', { count: extraCount }) : ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <StarBadge variant={variant} size={22} />
        {star.xp_awarded > 0 && (
          <span style={{ color: tokens.textMuted, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            +{star.xp_awarded} XP
          </span>
        )}
      </div>
    </div>
  )
}

function LeaderRow({ entry }: { entry: LeaderboardEntry }) {
  const { tokens } = useTheme()
  const isFirst = entry.rank === 1
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: isFirst ? tokens.primarySoft : tokens.bg,
        border: `1px solid ${isFirst ? tokens.primary : tokens.border}`,
        borderRadius: 10,
        minHeight: 48,
      }}
    >
      <div
        style={{
          minWidth: 28,
          textAlign: 'center',
          fontWeight: 800,
          color: rankAccent(entry.rank, tokens.text, tokens.textMuted),
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {entry.rank}
      </div>
      <Avatar seed={entry.display_name} size={36} />
      <div style={{ flex: 1, fontWeight: isFirst ? 800 : 600, color: tokens.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entry.display_name}
      </div>
      <StarBadge variant="gold" count={entry.xp} size={14} label={`${entry.xp} XP`} />
    </div>
  )
}

function StatChip({ label, value, variant }: { label: string; value: string; variant?: StarVariant }) {
  const { tokens } = useTheme()
  return (
    <div
      style={{
        background: tokens.bg,
        border: `1px solid ${tokens.border}`,
        borderRadius: 10,
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {variant ? <StarBadge variant={variant} size={20} /> : <div style={{ height: 20 }} />}
      <div style={{ fontWeight: 900, fontSize: 22, color: tokens.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ color: tokens.textMuted, fontSize: 11, textAlign: 'center' }}>{label}</div>
    </div>
  )
}

function rankAccent(rank: number, text: string, muted: string): string {
  if (rank === 1) return '#FFD700'
  if (rank === 2) return '#C0C0C0'
  if (rank === 3) return '#CD7F32'
  return rank <= 5 ? text : muted
}
