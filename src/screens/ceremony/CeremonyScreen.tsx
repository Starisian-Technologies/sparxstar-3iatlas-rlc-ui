import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { Fireworks } from '@/components/Fireworks'
import type { AwardsResponse, Star } from '@/types'

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
    return sorted
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
    }, 2000)
    return () => clearInterval(interval)
  }, [orderedStars])

  useEffect(() => {
    if (!awards) return
    if (revealedCount < orderedStars.length) return
    setShowFireworks(true)
    const timeout = setTimeout(() => setShowFireworks(false), 3000)
    return () => clearTimeout(timeout)
  }, [awards, orderedStars.length, revealedCount])

  if (loading) {
    return <FullScreenMessage title="Loading ceremony..." subtitle="Gathering class results." />
  }
  if (!awards) {
    return <FullScreenMessage title="Ceremony unavailable" subtitle={error ?? 'No awards data received.'} />
  }

  const revealedStars = orderedStars.slice(0, revealedCount)
  const starsDone = revealedCount >= orderedStars.length

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>Awards Ceremony</div>
        <div style={{ fontSize: 14, opacity: 0.85 }}>Session results</div>
      </div>

      <section style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Results summary</h2>
        <Row label="Total words / sentences" value={String(awards.total_tokens)} />
        <Row label="Discovery count" value={String(awards.discovery_count)} />
        <Row label="Class total participants" value={String(awards.leaderboard.length)} />
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Star announcements</h2>
        {revealedStars.map((star) => (
          <div key={`${star.category}-${star.participant_id}`} style={starCardStyle}>
            <div style={{ fontSize: 14, color: '#1B3A6B', fontWeight: 700 }}>{star.category}</div>
            <div style={winnerStyle}>{star.display_name}</div>
            <div style={{ fontSize: 14, color: '#555' }}>+{star.gold_bonus} Gold</div>
          </div>
        ))}
      </section>

      {starsDone && (
        <section style={sectionStyle}>
          <h2 style={sectionHeadingStyle}>Final leaderboard</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {awards.leaderboard.map((entry) => (
              <div key={entry.participant_id} style={leaderRowStyle}>
                <span style={{ minWidth: 28, fontWeight: 700 }}>{entry.rank}</span>
                <span style={{ flex: 1 }}>{entry.display_name}</span>
                <span>{entry.xp} XP</span>
                <span>{entry.gold} Gold</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {showFireworks && <Fireworks />}

      {starsDone && (
        <section style={sectionStyle}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1B3A6B' }}>Session complete</div>
          <button type="button" onClick={onPlayAgain} style={playAgainButtonStyle}>
            Play again
          </button>
        </section>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 16 }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function FullScreenMessage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={messageWrapStyle}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1B3A6B' }}>{title}</div>
      <div style={{ fontSize: 16, color: '#666' }}>{subtitle}</div>
    </div>
  )
}

const wrapStyle: React.CSSProperties = {
  minHeight: '100dvh',
  padding: 16,
  background: '#f4f4f4',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  position: 'relative',
}

const headerStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: 14,
  background: '#1B3A6B',
  color: '#fff',
}

const sectionStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#1B3A6B',
}

const starCardStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid #e5ddc3',
  padding: 12,
  background: '#fff9e8',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const winnerStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: '#C9A84C',
  transform: 'scale(1.03)',
}

const leaderRowStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid #ddd',
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 15,
}

const playAgainButtonStyle: React.CSSProperties = {
  minHeight: 52,
  borderRadius: 10,
  border: 'none',
  background: '#1B3A6B',
  color: '#fff',
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
  background: '#f4f4f4',
  padding: 16,
}
