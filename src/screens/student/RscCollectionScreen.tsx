import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessoryBar } from '@/components/AccessoryBar'
import { ContinuityBanner } from '@/components/ContinuityBanner'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useSessionPoll } from '@/hooks/useSessionPoll'
import { useSubmissionQueue } from '@/hooks/useSubmissionQueue'
import { emitRlcEvent, emitRuntimeEvent, RlcEventType } from '@/runtime/events'
import { GRAMMAR_DOMAINS } from '@/types'
import type { CollectionDepth, SaveTokenResponse } from '@/types'

interface RscCollectionScreenProps {
  session_id: string
  participant_id: string
  collection_depth: CollectionDepth
  language: string
  onSubmitted: (result: SaveTokenResponse) => void
  onCollectionCompleted: () => void
  onCollectionEnded: () => void
}

type Step = 'sentence' | 'translation' | 'recording' | 'done'

export function RscCollectionScreen({
  session_id,
  participant_id,
  collection_depth,
  language,
  onSubmitted,
  onCollectionCompleted,
  onCollectionEnded,
}: RscCollectionScreenProps) {
  const [step, setStep] = useState<Step>('sentence')
  const [sentence, setSentence] = useState('')
  const [translation, setTranslation] = useState('')
  const [completedDomains, setCompletedDomains] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<SaveTokenResponse | null>(null)
  const sentenceRef = useRef<HTMLInputElement>(null)
  const translationRef = useRef<HTMLInputElement>(null)
  const hasCollectionEndedRef = useRef(false)
  const { session, error: pollError } = useSessionPoll(session_id, true)
  const { isOnline } = useNetworkStatus()
  const { submit, syncState, pendingCount } = useSubmissionQueue(session_id, participant_id)

  useEffect(() => {
    if (!hasCollectionEndedRef.current && session?.status && session.status !== 'open') {
      hasCollectionEndedRef.current = true
      onCollectionEnded()
    }
  }, [onCollectionEnded, session?.status])

  const needsTranslation = collection_depth !== 'basic'
  const needsRecording = collection_depth === 'full'
  const totalDomains = GRAMMAR_DOMAINS.length
  const completedCount = completedDomains.size
  const currentDomain = useMemo(
    () => GRAMMAR_DOMAINS.find((domain) => !completedDomains.has(domain.index)) ?? null,
    [completedDomains],
  )

  const canProceedFromSentence = sentence.trim().length > 0
  const canProceedFromTranslation = translation.trim().length > 0
  const focusWord = findFocusWord(sentence, currentDomain?.slug ?? '')

  const insertChar = (char: string) => {
    const ref = step === 'sentence' ? sentenceRef : translationRef
    const el = ref.current
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const newVal = el.value.slice(0, start) + char + el.value.slice(end)
    if (step === 'sentence') setSentence(newVal)
    else setTranslation(newVal)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + char.length
      el.focus()
    })
  }

  const handleSubmit = async () => {
    if (!currentDomain) return
    setLoading(true)
    setError(null)
    try {
      if (needsRecording && step === 'recording') {
        emitRuntimeEvent('AUDIO_CAPTURED', {
          sessionId:     session_id,
          participantId: participant_id,
          mode:          'rsc',
          screen:        'student_rsc_collection',
          metadata: {
            grammarDomain: currentDomain.slug,
            placeholder:   true,
          },
        })
      }

      const { result, status } = await submit({
        session_id,
        participant_id,
        text:            sentence.trim(),
        translation:     needsTranslation ? translation.trim() : undefined,
        collection_mode: 'rsc',
        grammar_domain:  currentDomain.slug,
      })

      if (result) {
        setLastResult(result)
        onSubmitted(result)

        emitRlcEvent(RlcEventType.RLC_SENTENCE_CAPTURED, session_id, participant_id, {
          text:               sentence.trim(),
          language,
          grammar_domain:     currentDomain.slug,
          grammar_domain_idx: currentDomain.index,
        })
        emitRlcEvent(RlcEventType.RLC_SUBMISSION_SAVED, session_id, participant_id, {
          token_id:        result.token_id,
          spelling_signal: result.spelling_signal,
        })
        if (needsTranslation && translation.trim()) {
          emitRlcEvent(RlcEventType.RLC_TRANSLATION_ADDED, session_id, participant_id, {
            token_id:        result.token_id,
            translation:     translation.trim(),
            language_target: 'en',
          })
        }

        emitRuntimeEvent('WORD_SUBMITTED', {
          sessionId:     session_id,
          participantId: participant_id,
          mode:          'rsc',
          screen:        'student_rsc_collection',
          metadata: {
            tokenId:       result.token_id,
            grammarDomain: currentDomain.slug,
            hasTranslation: needsTranslation,
          },
        })
      } else if (status === 'failed') {
        // Submission is queued offline — advance to next domain anyway
        // so the student can keep working.
        setLastResult(null)
      }

      // Advance domain regardless of sync state (offline-first UX).
      const nextCompleted = new Set(completedDomains)
      nextCompleted.add(currentDomain.index)
      setCompletedDomains(nextCompleted)
      setSentence('')
      setTranslation('')
      setStep('sentence')
      if (nextCompleted.size === totalDomains) {
        onCollectionCompleted()
      }
    } catch {
      setError('Could not submit. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!currentDomain) {
    return (
      <div style={waitingWrap}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1B3A6B' }}>All 12 sentences submitted</div>
        <div style={{ fontSize: 16, color: '#555' }}>Waiting for teacher to start QC…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f4f4f4' }}>
      <div style={{ background: '#1B3A6B', padding: '12px 16px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 14, opacity: 0.85 }}>{completedCount} of {totalDomains} sentences complete</div>
          <SyncStatusIndicator syncState={syncState} pendingCount={pendingCount} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }} />
        </div>
        <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
          {GRAMMAR_DOMAINS.map((domain) => {
            const done = completedDomains.has(domain.index)
            const active = domain.index === currentDomain.index
            return (
              <div
                key={domain.slug}
                style={{
                  minHeight: 44,
                  borderRadius: 8,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  background: done ? '#62ad4b' : active ? '#C9A84C' : 'rgba(255,255,255,0.2)',
                  color: done || active ? '#1B3A6B' : '#fff',
                }}
              >
                {domain.index}
              </div>
            )
          })}
        </div>
      </div>

      {lastResult && (
        <div style={{
          background: lastResult.saturation_signal === 'saturated' ? '#fff7e4' : '#e6f1fb',
          color: lastResult.saturation_signal === 'saturated' ? '#8a6208' : '#0c447c',
          padding: '10px 16px',
          fontSize: 14,
        }}>
          {lastResult.saturation_signal === 'saturated'
            ? 'Great! We have lots of that word — try a different one.'
            : `Sentence saved. +${lastResult.xp_awarded} XP`}
        </div>
      )}

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ContinuityBanner
          isOnline={isOnline}
          hasConnectionIssue={Boolean(pollError)}
          hasDraft={Boolean(sentence.trim() || translation.trim())}
        />
        <div style={{ fontSize: 15, color: '#555' }}>Current domain</div>
        <div style={{ fontSize: 20, color: '#1B3A6B', fontWeight: 700 }}>{currentDomain.label}</div>
        <div style={{ fontSize: 16, color: '#1a1a1a' }}>{currentDomain.prompt}</div>
        <div style={{ fontSize: 14, color: '#666' }}>Focus element: {currentDomain.focus_element}</div>

        {step === 'sentence' && (
          <>
            <label style={labelStyle}>Type a sentence in {language}</label>
            <input
              ref={sentenceRef}
              type="text"
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              autoFocus
              placeholder="Type your sentence…"
              style={inputStyle}
              aria-label="Sentence input"
            />
            <FocusPreview sentence={sentence} focusWord={focusWord} />
            <button
              type="button"
              onClick={() => setStep(needsTranslation ? 'translation' : needsRecording ? 'recording' : 'done')}
              disabled={!canProceedFromSentence}
              style={primaryButtonStyle(!canProceedFromSentence)}
            >
              {needsTranslation ? 'Next →' : 'Submit'}
            </button>
          </>
        )}

        {step === 'translation' && (
          <>
            <label style={labelStyle}>What does this sentence mean in English or French?</label>
            <input
              ref={translationRef}
              type="text"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              autoFocus
              placeholder="Translation…"
              style={inputStyle}
              aria-label="Translation input"
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setStep('sentence')} style={backBtnStyle}>← Back</button>
              <button
                type="button"
                onClick={() => setStep(needsRecording ? 'recording' : 'done')}
                disabled={!canProceedFromTranslation}
                style={{ ...primaryButtonStyle(!canProceedFromTranslation), flex: 1 }}
              >
                {needsRecording ? 'Next →' : 'Submit'}
              </button>
            </div>
          </>
        )}

        {step === 'recording' && (
          <>
            <label style={labelStyle}>Record yourself saying the sentence</label>
            <div style={recorderPlaceholderStyle}>
              <div style={{ fontSize: 48 }}>🎙</div>
              <div>Starmus recorder mounts here</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>(@sparxstar/starmus-audio — to be wired in)</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setStep(needsTranslation ? 'translation' : 'sentence')} style={backBtnStyle}>← Back</button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={loading}
                style={{ ...primaryButtonStyle(loading), flex: 1 }}
              >
                {loading ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && !loading && (
          <button type="button" onClick={() => void handleSubmit()} style={primaryButtonStyle(false)}>
            Submit sentence
          </button>
        )}

        {error && (
          <div role="alert" style={errorStyle}>{error}</div>
        )}
      </div>

      <AccessoryBar onInsert={insertChar} />
    </div>
  )
}

function FocusPreview({ sentence, focusWord }: { sentence: string; focusWord: string | null }) {
  if (!sentence.trim()) return null
  if (!focusWord) {
    return <div style={{ fontSize: 14, color: '#666' }}>Keep typing to highlight the focus element.</div>
  }
  const escaped = focusWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = sentence.split(new RegExp(`(${escaped})`, 'i'))
  return (
    <div style={{ fontSize: 16, color: '#1a1a1a', lineHeight: 1.5 }}>
      {parts.map((part, index) => {
        const isFocus = part.toLowerCase() === focusWord.toLowerCase()
        return (
          <span
            key={`${part}-${index}`}
            style={isFocus ? { color: '#b30000', textDecoration: 'underline', textDecorationThickness: 2 } : undefined}
          >
            {part}
          </span>
        )
      })}
    </div>
  )
}

function findFocusWord(text: string, domainSlug: string): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null

  if (['noun_phrase', 'adjective', 'adverb', 'classifier', 'formal', 'informal'].includes(domainSlug)) {
    return words[0] ?? null
  }
  if (domainSlug === 'verb_phrase') {
    return words[1] ?? words[0] ?? null
  }
  if (domainSlug === 'possession') {
    return words[0] ?? null
  }
  if (domainSlug === 'numeric') {
    const match = words.find((word) => /\d/.test(word))
    return match ?? words[1] ?? words[0] ?? null
  }
  if (domainSlug === 'interjection') {
    return words.find((word) => /[!]/.test(word)) ?? words[0] ?? null
  }
  if (domainSlug === 'conjunction') {
    return words[Math.floor(words.length / 2)] ?? words[0] ?? null
  }
  if (domainSlug === 'question') {
    return words.find((word) => /[?]/.test(word)) ?? words[0] ?? null
  }
  return words[0] ?? null
}

const waitingWrap: React.CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: 10,
  padding: 20,
  textAlign: 'center',
  background: '#f4f4f4',
}

const labelStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#1a1a1a',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 18,
  padding: '14px 16px',
  border: '2px solid #b4b2a9',
  borderRadius: 10,
  boxSizing: 'border-box',
}

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  minHeight: 52,
  width: '100%',
  borderRadius: 10,
  border: 'none',
  background: disabled ? '#b4b2a9' : '#1B3A6B',
  color: '#fff',
  fontSize: 18,
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const backBtnStyle: React.CSSProperties = {
  minHeight: 52,
  padding: '0 20px',
  borderRadius: 10,
  border: '2px solid #b4b2a9',
  background: '#fff',
  color: '#1a1a1a',
  fontWeight: 600,
  cursor: 'pointer',
}

const recorderPlaceholderStyle: React.CSSProperties = {
  border: '2px dashed #b4b2a9',
  borderRadius: 12,
  padding: 40,
  textAlign: 'center',
  color: '#888',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}

const errorStyle: React.CSSProperties = {
  background: '#ffeded',
  border: '1px solid #f09595',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  color: '#a32d2d',
}
