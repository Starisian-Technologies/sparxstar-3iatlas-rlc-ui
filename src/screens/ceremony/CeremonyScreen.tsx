import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { Fireworks } from '@/components/Fireworks'
import type { AwardsResponse, LeaderboardEntry, Star } from '@/types'

interface CeremonyScreenProps {
  session_id: string
  onPlayAgain: () => void
}

const STAR_ORDER = [
  'Most Words / Sentences',
  'Best Accuracy',
  'Discovery Star',
  'Speed Star',
  'Audio Star',
  "Teacher's Star",
  'Teacher Award',
] as const

const STAR_REVEAL_INTERVAL_MS = 2000
const FIREWORKS_DURATION_MS = 4000

const AWARD_EMOJI: Record<string, string> = {
  'Most Words / Sentences': '👑',
  'Best Accuracy': '🌊',
  'Discovery Star': '💎',
  'Speed Star': '⚡',
  'Audio Star': '🎙️',
  "Teacher's Star": '🏆',
  'Teacher Award': '🏆',
}

export function CeremonyScreen({ session_id, onPlayAgain }: CeremonyScreenProps) {
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
    // Append any remaining stars not in the canonical order
    for (const star of awards.stars) {
      if (!sorted.some((s) => s.participant_id === star.participant_id && s.category === star.category)) {
        sorted.push(star)
      }
    }
    return sorted
  }, [awards])

  const top3 = useMemo((): LeaderboardEntry[] => {
    if (!awards) return []
    return [...awards.leaderboard]
      .filter((e) => e.rank >= 1 && e.rank <= 3)
      .sort((a, b) => a.rank - b.rank)
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
    if (!awards) return
    if (revealedCount < orderedStars.length) return
    setShowFireworks(true)
    const timeout = setTimeout(() => setShowFireworks(false), FIREWORKS_DURATION_MS)
    return () => clearTimeout(timeout)
  }, [awards, orderedStars.length, revealedCount])

  if (loading) {
    return <FullScreenMessage title="Loading ceremony…" subtitle="Gathering class results." />
  }
  if (!awards) {
    return <FullScreenMessage title="Ceremony unavailable" subtitle={error ?? 'No awards data received.'} />
  }

  const revealedStars = orderedStars.slice(0, revealedCount)
  const starsDone = revealedCount >= orderedStars.length

  return (
    <div style={wrapStyle}>
      {showFireworks && <Fireworks />}

      {/* ── Hero header ── */}
      <header style={heroStyle}>
        <div style={{ fontSize: 13, letterSpacing: 2, color: 'var(--accent-primary)', fontWeight: 700 }}>
          AWARDS CEREMONY
        </div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>Great game!</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Here are your champions</div>
      </header>

      {/* ── Podium top-3 ── */}
      {top3.length > 0 && <PodiumSection top3={top3} />}

      {/* ── Session stats ── */}
      <section style={panelStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <StatChip icon="💬" label="Words Collected" value={String(awards.total_tokens)} />
          <StatChip icon="🎯" label="Discoveries" value={String(awards.discovery_count)} />
          <StatChip icon="👥" label="Players" value={String(awards.leaderboard.length)} />
        </div>
      </section>

      {/* ── Star announcements ── */}
      {revealedStars.length > 0 && (
        <section style={panelStyle}>
          <div style={sectionTitleStyle}>🏅 Award Announcements</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {revealedStars.map((star) => (
              <StarCard key={`${star.category}-${star.participant_id}`} star={star} />
            ))}
          </div>
        </section>
      )}

      {/* ── Final leaderboard (after all stars revealed) ── */}
      {starsDone && awards.leaderboard.length > 0 && (
        <section style={panelStyle}>
          <div style={sectionTitleStyle}>Final Leaderboard</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {awards.leaderboard.map((entry) => (
              <div key={entry.participant_id} style={leaderRowStyle(entry.rank === 1)}>
                <span style={{ minWidth: 28, fontWeight: 700, color: rankColor(entry.rank) }}>
                  {rankIcon(entry.rank)}
                </span>
                <span style={{ flex: 1, fontWeight: entry.rank === 1 ? 700 : 400 }}>{entry.display_name}</span>
                <span style={{ color: 'var(--gold)' }}>{entry.xp} ⭐</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {starsDone && (
        <button type="button" onClick={onPlayAgain} style={playAgainBtnStyle}>
          Play again
        </button>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PodiumSection({ top3 }: { top3: LeaderboardEntry[] }) {
  const first = top3.find((e) => e.rank === 1)
  const second = top3.find((e) => e.rank === 2)
  const third = top3.find((e) => e.rank === 3)

  return (
    <section style={{ ...panelStyle, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, width: '100%' }}>
        {/* 2nd */}
        {second && <PodiumBlock entry={second} height={88} crown="🥈" />}
        {/* 1st */}
        {first && <PodiumBlock entry={first} height={110} crown="👑" highlight />}
        {/* 3rd */}
        {third && <PodiumBlock entry={third} height={72} crown="🥉" />}
      </div>
    </section>
  )
}

function PodiumBlock({
  entry, height, crown, highlight = false,
}: {
  entry: LeaderboardEntry
  height: number
  crown: string
  highlight?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
      <div style={{ fontSize: 20 }}>{crown}</div>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: highlight ? 'rgba(255,45,120,0.35)' : 'rgba(168,85,247,0.2)',
        border: `2px solid ${highlight ? 'var(--accent-primary)' : 'var(--accent-secondary)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>👤</div>
      <div style={{ fontWeight: 700, fontSize: 13, textAlign: 'center', maxWidth: 80, wordBreak: 'break-word' }}>
        {entry.display_name}
      </div>
      <div style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 700 }}>{entry.xp} ⭐</div>
      <div style={{
        width: '100%', height, borderRadius: '10px 10px 0 0',
        background: highlight
          ? 'linear-gradient(180deg, rgba(255,45,120,0.4) 0%, rgba(255,45,120,0.1) 100%)'
          : 'rgba(255,255,255,0.06)',
        border: '1px solid var(--border)',
      }} />
    </div>
  )
}

function StarCard({ star }: { star: Star }) {
  const emoji = AWARD_EMOJI[star.category] ?? '⭐'
  return (
    <div style={starCardStyle}>
      <div style={{ fontSize: 28 }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>{star.category}</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)' }}>{star.display_name}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>+{star.gold_bonus} Gold</div>
      </div>
    </div>
  )
}

function StatChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 8px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 4,
    }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 22 }}>{value}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 11, textAlign: 'center' }}>{label}</div>
    </div>
  )
}

function FullScreenMessage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={messageWrapStyle}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{subtitle}</div>
    </div>
  )
}

function rankColor(rank: number) {
  if (rank === 1) return '#FFD700'
  if (rank === 2) return '#C0C0C0'
  if (rank === 3) return '#CD7F32'
  return 'var(--text-secondary)'
}

function rankIcon(rank: number) {
  if (rank === 1) return '👑'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return String(rank)
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = {
  minHeight: '100dvh',
  padding: 16,
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  position: 'relative',
}

const heroStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: '18px 16px',
  background: 'linear-gradient(135deg, rgba(255,45,120,0.18) 0%, rgba(168,85,247,0.12) 100%)',
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  textAlign: 'center',
}

const panelStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
}

const starCardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(245,158,11,0.35)',
  background: 'rgba(245,158,11,0.08)',
  padding: '10px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const leaderRowStyle = (isFirst: boolean): React.CSSProperties => ({
  minHeight: 44,
  borderRadius: 10,
  border: `1px solid ${isFirst ? 'rgba(255,215,0,0.4)' : 'var(--border)'}`,
  background: isFirst ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)',
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
})

const playAgainBtnStyle: React.CSSProperties = {
  minHeight: 52,
  borderRadius: 12,
  border: 'none',
  background: 'var(--accent-primary)',
  color: 'var(--text-primary)',
  fontSize: 18,
  fontWeight: 700,
  cursor: 'pointer',
}

const messageWrapStyle: React.CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  textAlign: 'center',
  background: 'var(--bg)',
  padding: 16,
}
