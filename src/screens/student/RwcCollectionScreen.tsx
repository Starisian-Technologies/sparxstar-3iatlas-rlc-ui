import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api/client'
import { AccessoryBar } from '@/components/AccessoryBar'
import { AiGuidePanel } from '@/components/AiGuidePanel'
import { useSessionPoll } from '@/hooks/useSessionPoll'
import type { CollectionDepth, RoundCompleteSummary, SaveTokenResponse, SubmittedWord } from '@/types'

interface RwcCollectionScreenProps {
  session_id: string
  participant_id: string
  collection_depth: CollectionDepth
  language: string
  display_name: string
  onSubmitted: (result: SaveTokenResponse) => void
  onRoundComplete: (summary: RoundCompleteSummary) => void
  onClose: () => void
  onCollectionEnded: () => void
}

export function RwcCollectionScreen({
  session_id,
  participant_id,
  collection_depth,
  language,
  display_name,
  onSubmitted,
  onRoundComplete,
  onClose,
  onCollectionEnded,
}: RwcCollectionScreenProps) {
  const [word, setWord] = useState('')
  const [translation, setTranslation] = useState('')
  const [showTranslationField, setShowTranslationField] = useState(collection_depth !== 'basic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<SaveTokenResponse | null>(null)
  const [submittedWords, setSubmittedWords] = useState<SubmittedWord[]>([])
  const { session } = useSessionPoll(session_id, true)
  const inputRef = useRef<HTMLInputElement>(null)
  const roundRef = useRef<number | null>(null)
  const roundEndedRef = useRef(false)
  const sessionEndedRef = useRef(false)

  const currentRound = session?.current_round ?? 1
  const totalRounds = session?.total_rounds ?? 5
  const roundGoal = session?.round_goal ?? 10
  const promptWord = getPromptWord(session?.semantic_domain_id)
  const minutes = Math.floor((session?.time_remaining_seconds ?? 0) / 60)
  const seconds = (session?.time_remaining_seconds ?? 0) % 60
  const needsTranslation = collection_depth !== 'basic'

  useEffect(() => {
    if (roundRef.current === null) {
      roundRef.current = currentRound
    }
  }, [currentRound])

  useEffect(() => {
    if (!sessionEndedRef.current && session?.status && session.status !== 'open') {
      sessionEndedRef.current = true
      onCollectionEnded()
    }
  }, [onCollectionEnded, session?.status])

  useEffect(() => {
    if (!session?.current_round || roundRef.current === null) return
    if (session.current_round === roundRef.current) return
    if (session.current_round > roundRef.current && !roundEndedRef.current) {
      roundEndedRef.current = true
      onRoundComplete(buildRoundSummary({
        round: roundRef.current,
        totalRounds,
        submittedWords,
        leaderboard: session.leaderboard,
        participant_id,
        display_name,
      }))
      setSubmittedWords([])
    }
    roundRef.current = session.current_round
    roundEndedRef.current = false
  }, [display_name, onRoundComplete, participant_id, session, submittedWords, totalRounds])

  const myLeaderboard = useMemo(
    () => session?.leaderboard.find((entry) => entry.participant_id === participant_id || entry.display_name === display_name),
    [display_name, participant_id, session?.leaderboard],
  )

  const progressCount = submittedWords.length
  const progressPct = Math.min(100, (progressCount / roundGoal) * 100)

  const insertChar = (char: string) => {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const newVal = el.value.slice(0, start) + char + el.value.slice(end)
    setWord(newVal)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + char.length
      el.focus()
    })
  }

  const submitWord = async () => {
    if (!word.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.token.save({
        session_id,
        participant_id,
        text: word.trim(),
        translation: needsTranslation ? translation.trim() || undefined : undefined,
        collection_mode: 'rwc',
      })
      setLastResult(result)
      onSubmitted(result)
      const item: SubmittedWord = {
        id: result.token_id,
        word: word.trim(),
        translation: needsTranslation ? translation.trim() || undefined : undefined,
        xp_awarded: result.xp_awarded,
      }
      setSubmittedWords((prev) => [item, ...prev].slice(0, 20))
      setWord('')
      setTranslation('')
    } catch {
      setError('Could not submit. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={wrapStyle}>
      <header style={headerStyle}>
        <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="Back to lobby">✕</button>
        <div style={chipStyle}>🕘 {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</div>
        <div style={chipStyle}>👥 {session?.participant_count ?? 0}</div>
      </header>

      <section style={mainCardStyle}>
        <div style={roundLabelStyle}>ROUND {currentRound} / {totalRounds}</div>
        <div style={{ textAlign: 'center', fontSize: 29, fontWeight: 800, color: 'var(--accent-primary)' }}>{promptWord}</div>
        <div style={progressOuterStyle}>
          <div style={{ ...progressInnerStyle, width: `${progressPct}%` }} />
        </div>
        <div style={{ color: 'var(--text-secondary)', textAlign: 'right', fontSize: 13 }}>{progressCount} / {roundGoal} words</div>
      </section>

      <section style={inputWrapStyle}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={word}
            onChange={(event) => setWord(event.target.value)}
            placeholder={`Type a word in ${language}`}
            style={inputStyle}
            aria-label="Word input"
          />
          <button type="button" onClick={() => void submitWord()} disabled={!word.trim() || loading} style={sendBtnStyle}>
            ➤
          </button>
        </div>
        {needsTranslation && showTranslationField && (
          <input
            value={translation}
            onChange={(event) => setTranslation(event.target.value)}
            placeholder="Optional translation"
            style={inputStyle}
            aria-label="Translation input"
          />
        )}
        {needsTranslation && (
          <button type="button" onClick={() => setShowTranslationField((value) => !value)} style={ghostBtnStyle}>
            {showTranslationField ? 'Hide translation field' : 'Add translation'}
          </button>
        )}
        {lastResult && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {lastResult.saturation_signal === 'saturated'
              ? 'We have many of this word already. Try another.'
              : `Saved +${lastResult.xp_awarded} XP`}
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <div style={sectionTitleStyle}>Your words</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
          {submittedWords.map((entry) => (
            <div key={entry.id} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{entry.word}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{entry.translation ?? 'No translation'}</div>
              </div>
            <div style={{ color: 'var(--gold)', fontWeight: 700 }}>+{entry.xp_awarded} ⭐</div>
            </div>
          ))}
          {submittedWords.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No words yet.</div>}
        </div>
      </section>

      <section style={panelStyle}>
        <div style={sectionTitleStyle}>Leaderboard</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(session?.leaderboard ?? []).slice(0, 4).map((entry) => (
            <div
              key={entry.participant_id}
              style={{
                ...rowStyle,
                background: entry.participant_id === participant_id ? 'rgba(255,45,120,0.2)' : 'rgba(255,255,255,0.03)',
              }}
            >
              <span style={{ minWidth: 22, color: 'var(--text-secondary)' }}>{entry.rank}</span>
              <span style={{ flex: 1 }}>
                {entry.display_name}
                {entry.participant_id === participant_id ? ' (You)' : ''}
              </span>
              <span style={{ color: 'var(--gold)' }}>{entry.xp} ⭐</span>
            </div>
          ))}
        </div>
        {myLeaderboard && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            You are rank {myLeaderboard.rank} with {myLeaderboard.xp} points.
          </div>
        )}
      </section>

      {error && <div role="alert" style={errorStyle}>{error}</div>}

      <AiGuidePanel compact />
      <AccessoryBar onInsert={insertChar} />
    </div>
  )
}

function buildRoundSummary(input: {
  round: number
  totalRounds: number
  submittedWords: SubmittedWord[]
  leaderboard: Array<{ participant_id: string; display_name: string; rank: number; xp: number }>
  participant_id: string
  display_name: string
}): RoundCompleteSummary {
  const top_words = [...input.submittedWords].sort((a, b) => b.xp_awarded - a.xp_awarded).slice(0, 5)
  const points_earned = input.submittedWords.reduce((sum, item) => sum + item.xp_awarded, 0)
  const me = input.leaderboard.find(
    (entry) => entry.participant_id === input.participant_id || entry.display_name === input.display_name,
  )
  return {
    round: input.round,
    total_rounds: input.totalRounds,
    words_collected: input.submittedWords.length,
    points_earned,
    stars_earned: Math.max(1, Math.floor(points_earned / 100)),
    top_words,
    player_score: me?.xp ?? points_earned,
    player_rank: me?.rank ?? 1,
    total_players: input.leaderboard.length || 1,
  }
}

function getPromptWord(semanticDomainId?: string): string {
  if (!semanticDomainId) return 'TARGET WORD'
  const token = semanticDomainId.split(/[.\s_-]+/).slice(-1)[0]
  if (!token) return 'TARGET WORD'
  return token.toUpperCase()
}

const wrapStyle: React.CSSProperties = {
  minHeight: '100dvh',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 12,
}

const headerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '44px 1fr 1fr',
  gap: 8,
}

const closeBtnStyle: React.CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
}

const chipStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 999,
  background: 'var(--card)',
  border: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
}

const mainCardStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const roundLabelStyle: React.CSSProperties = {
  color: 'var(--accent-primary)',
  textAlign: 'center',
  fontWeight: 700,
  letterSpacing: 1.1,
}

const progressOuterStyle: React.CSSProperties = {
  height: 8,
  background: 'rgba(255,255,255,0.1)',
  borderRadius: 999,
  overflow: 'hidden',
}

const progressInnerStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
}

const inputWrapStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.03)',
  color: 'var(--text-primary)',
  padding: '0 14px',
  fontSize: 16,
}

const sendBtnStyle: React.CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  borderRadius: 999,
  border: 'none',
  background: 'var(--accent-primary)',
  color: 'var(--text-primary)',
  fontWeight: 800,
  cursor: 'pointer',
}

const ghostBtnStyle: React.CSSProperties = {
  minHeight: 44,
  width: '100%',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}

const panelStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 22,
}

const rowStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 10,
  border: '1px solid var(--border)',
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
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
