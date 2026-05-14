import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessoryBar } from '@/components/AccessoryBar'
import { AiGuidePanel } from '@/components/AiGuidePanel'
import { ContinuityBanner } from '@/components/ContinuityBanner'
import { SpellingSignalDot } from '@/components/SpellingSignalDot'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useSessionPoll } from '@/hooks/useSessionPoll'
import { useSubmissionQueue } from '@/hooks/useSubmissionQueue'
import { emitRlcEvent, emitRuntimeEvent, RlcEventType } from '@/runtime/events'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<SaveTokenResponse | null>(null)
  const [submittedWords, setSubmittedWords] = useState<SubmittedWord[]>([])
  const { session, error: pollError } = useSessionPoll(session_id, true)
  const { isOnline } = useNetworkStatus()
  const { submit, syncState, pendingCount, syncedSubmissions } = useSubmissionQueue(session_id, participant_id)
  const wordInputRef = useRef<HTMLInputElement>(null)
  const translationInputRef = useRef<HTMLInputElement>(null)
  const lastFocusedInputRef = useRef<'word' | 'translation'>('word')
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

  useEffect(() => {
    if (syncedSubmissions.length === 0) return
    const synced = new Map(syncedSubmissions.map((receipt) => [receipt.localId, receipt.result]))
    setSubmittedWords((prev) => prev.map((item) => {
      const result = synced.get(item.id)
      if (!result) return item
      return {
        ...item,
        syncStatus:      'synced',
        token_id:        result.token_id,
        xp_awarded:      result.xp_awarded,
        spelling_signal: result.spelling_signal,
      }
    }))
  }, [syncedSubmissions])

  const myLeaderboard = useMemo(
    () => session?.leaderboard.find((entry) => entry.participant_id === participant_id || entry.display_name === display_name),
    [display_name, participant_id, session?.leaderboard],
  )

  const progressCount = submittedWords.length
  const progressPct = Math.min(100, (progressCount / roundGoal) * 100)
  const trimmedWord = word.trim()
  const trimmedTranslation = translation.trim()
  const canSubmit = trimmedWord.length > 0 && (!needsTranslation || trimmedTranslation.length > 0)

  const handleInputFocus = (field: 'word' | 'translation') => {
    lastFocusedInputRef.current = field
  }

  const insertChar = (char: string) => {
    const target = lastFocusedInputRef.current
    const el = target === 'translation' ? translationInputRef.current : wordInputRef.current
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const newVal = el.value.slice(0, start) + char + el.value.slice(end)
    if (target === 'translation') setTranslation(newVal)
    else setWord(newVal)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + char.length
      el.focus()
    })
  }

  const submitWord = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)

    const hasTranslation = needsTranslation && trimmedTranslation.length > 0

    // Capture values before clearing fields.
    const wordValue        = trimmedWord
    const translationValue = hasTranslation ? trimmedTranslation : undefined

    // Clear fields immediately so the student can start the next word.
    setWord('')
    setTranslation('')

    // Use a stable placeholder key until `submit()` resolves with the queue ID.
    const placeholderId = crypto.randomUUID()
    const tempItem: SubmittedWord = {
      id:          placeholderId,
      word:        wordValue,
      translation: translationValue,
      xp_awarded:  0,
      syncStatus:  'queued',
    }

    // 1. Show submission immediately (offline-first UX).
    setSubmittedWords((prev) => [tempItem, ...prev].slice(0, 20))

    try {
      const { localId, result, status } = await submit({
        session_id,
        participant_id,
        text:            wordValue,
        translation:     translationValue,
        collection_mode: 'rwc',
      })

      if (result) {
        // 2a. Update the list entry with server-confirmed data.
        //     Keep `id` stable (= localId from queue) to avoid React key churn.
        setSubmittedWords((prev) => prev.map((item) =>
          item.id === placeholderId
            ? {
                ...item,
                id:              localId,
                token_id:        result.token_id,
                xp_awarded:      result.xp_awarded,
                syncStatus:      'synced',
                spelling_signal: result.spelling_signal,
              }
            : item,
        ))
        setLastResult(result)
        onSubmitted(result)

        emitRlcEvent(RlcEventType.RLC_WORD_CAPTURED, session_id, participant_id, {
          text:               wordValue,
          language,
          ...(session?.semantic_domain_id ? { semantic_domain_id: session.semantic_domain_id } : {}),
        })
        emitRlcEvent(RlcEventType.RLC_SUBMISSION_SAVED, session_id, participant_id, {
          token_id:        result.token_id,
          spelling_signal: result.spelling_signal,
        })
        if (hasTranslation && translationValue) {
          emitRlcEvent(RlcEventType.RLC_TRANSLATION_ADDED, session_id, participant_id, {
            token_id:        result.token_id,
            translation:     translationValue,
            language_target: 'en',
          })
        }

        emitRuntimeEvent('WORD_SUBMITTED', {
          sessionId:     session_id,
          participantId: participant_id,
          mode:          'rwc',
          screen:        'student_rwc_collection',
          metadata: {
            tokenId:        result.token_id,
            hasTranslation,
          },
        })
      } else if (status === 'failed') {
        // 2b. Submission is queued — swap placeholder ID with stable queue ID.
        setSubmittedWords((prev) => prev.map((item) =>
          item.id === placeholderId ? { ...item, id: localId } : item,
        ))
        setLastResult(null)
      }
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
        <div style={chipStyle}>⭐ {myLeaderboard?.xp ?? 0}</div>
        <SyncStatusIndicator syncState={syncState} pendingCount={pendingCount} />
      </header>

      <ContinuityBanner
        isOnline={isOnline}
        hasConnectionIssue={Boolean(pollError)}
        hasDraft={Boolean(word.trim() || translation.trim())}
      />

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
            ref={wordInputRef}
            value={word}
            onChange={(event) => setWord(event.target.value)}
            onFocus={() => handleInputFocus('word')}
            placeholder={`Type a word in ${language}`}
            style={inputStyle}
            aria-label="Word input"
          />
          <button type="button" onClick={() => void submitWord()} disabled={!canSubmit || loading} style={sendBtnStyle}>
            ➤
          </button>
        </div>
        {needsTranslation && (
          <input
            ref={translationInputRef}
            value={translation}
            onChange={(event) => setTranslation(event.target.value)}
            onFocus={() => handleInputFocus('translation')}
            placeholder="Type translation (required)"
            style={inputStyle}
            aria-label="Translation input"
          />
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
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {entry.word}
                  <SpellingSignalDot signal={entry.spelling_signal} />
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{entry.translation ?? 'No translation'}</div>
              </div>
              {entry.syncStatus === 'queued'
                ? <span style={queuedBadgeStyle}>queued</span>
                : <div style={{ color: 'var(--gold)', fontWeight: 700 }}>+{entry.xp_awarded} ⭐</div>
              }
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

      <AiGuidePanel compact context={{ language, mode: 'rwc', sourceText: word || promptWord }} />
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
  gridTemplateColumns: '44px 1fr 1fr 1fr 44px',
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

const queuedBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#F59E0B',
  background: 'rgba(245,158,11,0.15)',
  border: '1px solid rgba(245,158,11,0.4)',
  borderRadius: 999,
  padding: '2px 8px',
  whiteSpace: 'nowrap',
}
