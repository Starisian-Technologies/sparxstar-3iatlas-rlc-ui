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
import { api } from '@/api/client'
import { Fireworks } from '@/components/Fireworks'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Avatar } from '@/components/Avatar'
import { StarBadge, type StarVariant } from '@/components/StarBadge'
import { TenantLogo } from '@/components/TenantLogo'
import { useTheme } from '@/theme/useTheme'
import { emitRuntimeEvent } from '@/runtime/events'
import type { AwardsResponse, LeaderboardEntry, Star } from '@/types'

interface CeremonyScreenProps {
  session_id: string
  onReturnToSession: () => void
}

/** Reveal order — backend category strings, displayed in this sequence. */
const STAR_ORDER = [
  'most_words',
  'most_sentences',
  'best_spelling',
  'discovery',
  'speed',
  'audio',
  'teacher',
  'teacher_award',
] as const

const STAR_REVEAL_INTERVAL_MS = 2000
const FIREWORKS_DURATION_MS = 4500

/** Maps backend category strings (spec §6.5) to StarBadge variants. */
function variantForCategory(category: string): StarVariant {
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

export function CeremonyScreen({ session_id, onReturnToSession }: CeremonyScreenProps) {
  const { tokens, resolved } = useTheme()
  const [awards, setAwards] = useState<AwardsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const [showFireworks, setShowFireworks] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    void (async () => {
      try {
        const result = await api.session.awards(session_id)
        if (!active) return
        setAwards(result)
        setError(null)
      } catch {
        if (!active) return
        setError('Could not load awards.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [session_id])

  const orderedStars = useMemo(() => {
    if (!awards) return []
    const sorted: Star[] = []
    for (const label of STAR_ORDER) {
      const star = awards.stars.find((item) => item.category === label || item.label === label)
      if (star) sorted.push(star)
    }
    for (const star of awards.stars) {
      if (!sorted.some((s) => s.participant_id === star.participant_id && s.category === star.category)) {
        sorted.push(star)
      }
    }
    return sorted
  }, [awards])

  const top3 = useMemo((): LeaderboardEntry[] => {
    if (!awards) return []
    return [...awards.leaderboard].filter((e) => e.rank >= 1 && e.rank <= 3).sort((a, b) => a.rank - b.rank)
  }, [awards])

  useEffect(() => {
    if (orderedStars.length === 0) return
    setRevealedCount(0)
    const interval = setInterval(() => {
      setRevealedCount((count) => {
        if (count >= orderedStars.length) {
          clearInterval(interval)
          return count
        }
        return count + 1
      })
    }, STAR_REVEAL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [orderedStars])

  useEffect(() => {
    if (revealedCount <= 0) return
    const revealedStar = orderedStars[revealedCount - 1]
    if (!revealedStar) return
    emitRuntimeEvent('AWARD_REVEALED', {
      sessionId: session_id,
      screen: 'ceremony',
      metadata: {
        category: revealedStar.category,
        participantId: revealedStar.participant_id,
        displayName: revealedStar.display_name,
      },
    })
  }, [orderedStars, revealedCount, session_id])

  useEffect(() => {
    if (!awards) return
    if (revealedCount < orderedStars.length) return
    setShowFireworks(true)
    const timeout = setTimeout(() => setShowFireworks(false), FIREWORKS_DURATION_MS)
    return () => clearTimeout(timeout)
  }, [awards, orderedStars.length, revealedCount])

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
  const starsDone = revealedCount >= orderedStars.length

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
          <StatChip label="Players" value={String(awards.leaderboard.length)} />
        </div>
      </Card>

      {/* Star announcements */}
      {revealedStars.length > 0 && (
        <Card>
          <div style={{ fontSize: 16, fontWeight: 800, color: tokens.text, marginBottom: 8 }}>Award announcements</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {revealedStars.map((star) => (
              <StarRow key={`${star.category}-${star.participant_id}`} star={star} />
            ))}
          </div>
        </Card>
      )}

      {/* Final leaderboard */}
      {starsDone && awards.leaderboard.length > 0 && (
        <Card>
          <div style={{ fontSize: 16, fontWeight: 800, color: tokens.text, marginBottom: 8 }}>Final leaderboard</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {awards.leaderboard.map((entry) => (
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
  const variant = variantForCategory(star.category)
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
      <Avatar seed={star.display_name} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: tokens.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          {star.category}
        </div>
        <div style={{ fontWeight: 800, fontSize: 17, color: tokens.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {star.display_name}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <StarBadge variant={variant} size={22} />
        {star.gold_bonus > 0 && (
          <span style={{ color: tokens.textMuted, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            +{star.gold_bonus} gold
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
