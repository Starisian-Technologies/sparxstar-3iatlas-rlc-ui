import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessoryBar } from '@/components/AccessoryBar'
import { ContinuityBanner } from '@/components/ContinuityBanner'
import { StarBadge } from '@/components/StarBadge'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { TenantLogo } from '@/components/TenantLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useSessionSocket } from '@/hooks/useSessionSocket'
import { useSubmissionQueue } from '@/hooks/useSubmissionQueue'
import { emitRlcEvent, emitRuntimeEvent, RlcEventType } from '@/runtime/events'
import { useTheme } from '@/theme/useTheme'
import { GRAMMAR_DOMAINS } from '@/types'
import type { CollectionDepth, SaveTokenResponse, SessionStatus } from '@/types'

interface RscCollectionScreenProps {
  session_id: string
  participant_id: string
  participant_token: string | null
  collection_depth: CollectionDepth
  language: string
  onSubmitted: (result: SaveTokenResponse) => void
  onCollectionCompleted: (submittedCount: number) => void
  onCollectionEnded: (status: SessionStatus) => void
}

type Step = 'sentence' | 'translation' | 'recording' | 'done'

export function RscCollectionScreen({
  session_id,
  participant_id,
  participant_token,
  collection_depth,
  language,
  onSubmitted,
  onCollectionCompleted,
  onCollectionEnded,
}: RscCollectionScreenProps) {
  const { t } = useTranslation()
  const { tokens } = useTheme()
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
  const processedReceiptsRef = useRef<Set<string>>(new Set())
  const auth = useMemo(
    () => participant_token ? { token: participant_token } : null,
    [participant_token],
  )
  const { session, error: pollError } = useSessionSocket(session_id, true, { auth })
  const { isOnline } = useNetworkStatus()
  const { submit, syncState, pendingCount, syncedSubmissions } = useSubmissionQueue(session_id, participant_id)

  useEffect(() => {
    const status = session?.status
    if (!hasCollectionEndedRef.current && status && status !== 'open') {
      hasCollectionEndedRef.current = true
      onCollectionEnded(status)
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

  useEffect(() => {
    if (syncedSubmissions.length === 0) return
    const myReceipts = syncedSubmissions.filter((r) => r.participantId === participant_id)
    if (myReceipts.length === 0) return
    let latestResult: SaveTokenResponse | null = null
    for (const receipt of myReceipts) {
      if (processedReceiptsRef.current.has(receipt.localId)) continue
      processedReceiptsRef.current.add(receipt.localId)
      onSubmitted(receipt.result)
      latestResult = receipt.result
      emitRuntimeEvent('WORD_SUBMITTED', {
        sessionId:     session_id,
        participantId: participant_id,
        mode:          'rsc',
        screen:        'student_rsc_collection',
        metadata: {
          tokenId:        receipt.result.token_id,
          hasTranslation: needsTranslation,
        },
      })
    }
    if (latestResult) setLastResult(latestResult)
  }, [syncedSubmissions, onSubmitted, session_id, participant_id, needsTranslation])

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

      const sentenceValue = sentence.trim()
      const translationValue = needsTranslation ? translation.trim() : undefined

      emitRlcEvent(RlcEventType.RLC_SENTENCE_CAPTURED, session_id, participant_id, {
        text:               sentenceValue,
        language,
        grammar_domain:     currentDomain.slug,
        grammar_domain_idx: currentDomain.index,
      })
      if (translationValue) {
        emitRlcEvent(RlcEventType.RLC_TRANSLATION_ADDED, session_id, participant_id, {
          translation:     translationValue,
          language_target: 'en',
        })
      }

      // Contract §3.5: RSC requires translation: string (use '' for basic depth)
      // and grammar_domain_index (server derives the canonical grammar_domain).
      // Do NOT send grammar_domain too — the UI's slug may not match the
      // backend's canonical name and the server returns 400 grammar_domain_mismatch.
      await submit({
        session_id,
        participant_id,
        text:                 sentenceValue,
        translation:          translationValue ?? '',
        collection_mode:      'rsc',
        grammar_domain_index: currentDomain.index,
      })

      const nextCompleted = new Set(completedDomains)
      nextCompleted.add(currentDomain.index)
      setCompletedDomains(nextCompleted)
      setSentence('')
      setTranslation('')
      setStep('sentence')
      if (nextCompleted.size === totalDomains) {
        onCollectionCompleted(nextCompleted.size)
      }
    } catch {
      setError('Could not submit. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!currentDomain) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        padding: 24,
        textAlign: 'center',
        background: tokens.bg,
        color: tokens.text,
      }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{t('collection_rsc.all_submitted', { defaultValue: 'All {{count}} sentences submitted', count: totalDomains })}</div>
        <div style={{ fontSize: 15, color: tokens.textMuted }}>{t('collection_rsc.waiting_review', { defaultValue: 'Waiting for the teacher to start the review…' })}</div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: 18,
    padding: '14px 16px',
    border: `1.5px solid ${tokens.border}`,
    borderRadius: 12,
    background: tokens.bg,
    color: tokens.text,
    boxSizing: 'border-box',
    outline: 'none',
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: tokens.bg }}>
      {/* Header */}
      <div style={{
        background: tokens.bgElevated,
        borderBottom: `1px solid ${tokens.border}`,
        padding: '10px 16px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <TenantLogo size="small" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SyncStatusIndicator syncState={syncState} pendingCount={pendingCount} />
            <ThemeToggle />
          </div>
        </div>

        {/* Progress info */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: tokens.textMuted, fontWeight: 600 }}>
            {t('collection_rsc.progress', { defaultValue: '{{done}} of {{total}} done', done: completedCount, total: totalDomains })}
          </div>
          {lastResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <StarBadge variant="gold" count={`+${lastResult.xp_awarded}`} size={13} label={`${lastResult.xp_awarded} XP`} />
            </div>
          )}
        </div>

        {/* Domain progress tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 5 }}>
          {GRAMMAR_DOMAINS.map((domain) => {
            const done = completedDomains.has(domain.index)
            const active = domain.index === currentDomain.index
            return (
              <div
                key={domain.slug}
                title={domain.label}
                style={{
                  minHeight: 36,
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: done
                    ? tokens.success
                    : active
                    ? tokens.primary
                    : tokens.card,
                  color: done || active ? '#fff' : tokens.textMuted,
                  border: active ? `2px solid ${tokens.primaryDeep}` : `1px solid ${tokens.border}`,
                  boxShadow: active ? `0 0 10px ${tokens.glow}` : 'none',
                  transition: 'background 200ms ease',
                }}
              >
                {domain.index}
              </div>
            )
          })}
        </div>
      </div>

      {/* Feedback banner */}
      {lastResult && (
        <div style={{
          background: lastResult.saturation_signal === 'saturated'
            ? `rgba(245,200,66,0.15)`
            : `rgba(34,197,94,0.12)`,
          color: lastResult.saturation_signal === 'saturated'
            ? tokens.warning
            : tokens.success,
          padding: '10px 16px',
          fontSize: 14,
          fontWeight: 600,
          borderBottom: `1px solid ${tokens.border}`,
        }}>
          {lastResult.saturation_signal === 'saturated'
            ? 'Great! We have lots of that — try a different sentence.'
            : `Sentence saved — you earned ${lastResult.xp_awarded} XP!`}
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ContinuityBanner
          isOnline={isOnline}
          hasConnectionIssue={Boolean(pollError)}
          hasDraft={Boolean(sentence.trim() || translation.trim())}
        />

        {/* Domain card */}
        <div style={{
          background: tokens.card,
          border: `1px solid ${tokens.border}`,
          borderRadius: 14,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>
            {t('collection_rsc.grammar_type', { defaultValue: 'Grammar type' })}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: tokens.primary }}>
            {currentDomain.label}
          </div>
          <div style={{ fontSize: 15, color: tokens.text, lineHeight: 1.4 }}>
            {currentDomain.prompt}
          </div>
          <div style={{ fontSize: 13, color: tokens.textMuted }}>
            {t('collection_rsc.focus_prefix', { defaultValue: 'Focus:' })} <span style={{ color: tokens.text, fontWeight: 600 }}>{currentDomain.focus_element}</span>
          </div>
        </div>

        {step === 'sentence' && (
          <>
            <label
              htmlFor="rsc-sentence"
              style={{ fontSize: 15, fontWeight: 700, color: tokens.text }}
            >
              Type a sentence in {language}
            </label>
            <input
              id="rsc-sentence"
              ref={sentenceRef}
              type="text"
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              autoFocus
              placeholder={t('collection_rsc.sentence_placeholder', { defaultValue: 'Type your sentence…' })}
              style={inputStyle}
              aria-label={t('collection_rsc.sentence_aria', { defaultValue: 'Sentence input' })}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              lang={language}
            />
            <FocusPreview sentence={sentence} focusWord={focusWord} tokens={tokens} />
            <button
              type="button"
              onClick={() => setStep(needsTranslation ? 'translation' : needsRecording ? 'recording' : 'done')}
              disabled={!canProceedFromSentence}
              style={primaryBtnStyle(tokens, !canProceedFromSentence)}
            >
              {needsTranslation ? 'Next →' : 'Submit'}
            </button>
          </>
        )}

        {step === 'translation' && (
          <>
            <label
              htmlFor="rsc-translation"
              style={{ fontSize: 15, fontWeight: 700, color: tokens.text }}
            >
              {t('collection_rsc.translate_prompt', { defaultValue: 'What does this sentence mean in English?' })}
            </label>
            <input
              id="rsc-translation"
              ref={translationRef}
              type="text"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              autoFocus
              placeholder={t('collection_rsc.translation_placeholder', { defaultValue: 'Translation…' })}
              style={inputStyle}
              aria-label={t('collection_rsc.translation_aria', { defaultValue: 'Translation input' })}
              autoCapitalize="off"
              autoComplete="off"
              spellCheck
              inputMode="text"
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setStep('sentence')}
                style={{
                  minHeight: 52,
                  padding: '0 20px',
                  borderRadius: 12,
                  border: `1.5px solid ${tokens.border}`,
                  background: 'transparent',
                  color: tokens.textMuted,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(needsRecording ? 'recording' : 'done')}
                disabled={!canProceedFromTranslation}
                style={{ ...primaryBtnStyle(tokens, !canProceedFromTranslation), flex: 1 }}
              >
                {needsRecording ? 'Next →' : 'Submit'}
              </button>
            </div>
          </>
        )}

        {step === 'recording' && (
          <>
            <label style={{ fontSize: 15, fontWeight: 700, color: tokens.text }}>
              {t('collection_rsc.record_prompt', { defaultValue: 'Record yourself saying the sentence' })}
            </label>
            <div style={{
              border: `2px dashed ${tokens.border}`,
              borderRadius: 14,
              padding: 40,
              textAlign: 'center',
              color: tokens.textMuted,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 44 }}>🎙</span>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{t('collection_rsc.recorder_title', { defaultValue: 'Starmus recorder' })}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>(@sparxstar/starmus-audio — wiring in progress)</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setStep(needsTranslation ? 'translation' : 'sentence')}
                style={{
                  minHeight: 52,
                  padding: '0 20px',
                  borderRadius: 12,
                  border: `1.5px solid ${tokens.border}`,
                  background: 'transparent',
                  color: tokens.textMuted,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={loading}
                style={{ ...primaryBtnStyle(tokens, loading), flex: 1 }}
              >
                {loading ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && !loading && (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            style={primaryBtnStyle(tokens, false)}
          >
            {t('collection_rsc.submit', { defaultValue: 'Submit sentence' })}
          </button>
        )}

        {loading && step !== 'recording' && (
          <div style={{ textAlign: 'center', color: tokens.textMuted, fontSize: 14 }}>{t('collection_rsc.submitting', { defaultValue: 'Submitting…' })}</div>
        )}

        {error && (
          <div role="alert" style={{
            background: 'rgba(239,68,68,0.1)',
            border: `1px solid ${tokens.danger}`,
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 14,
            color: tokens.danger,
          }}>
            {error}
          </div>
        )}
      </div>

      <AccessoryBar onInsert={insertChar} />
    </div>
  )
}

function FocusPreview({
  sentence,
  focusWord,
  tokens,
}: {
  sentence: string
  focusWord: string | null
  tokens: { text: string; primary: string; textMuted: string }
}) {
  const { t } = useTranslation()
  if (!sentence.trim()) return null
  if (!focusWord) {
    return <div style={{ fontSize: 14, color: tokens.textMuted }}>{t('collection_rsc.focus_hint', { defaultValue: 'Keep typing to highlight the focus element.' })}</div>
  }
  const escaped = focusWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = sentence.split(new RegExp(`(${escaped})`, 'i'))
  return (
    <div style={{ fontSize: 16, color: tokens.text, lineHeight: 1.5 }}>
      {parts.map((part, index) => {
        const isFocus = part.toLowerCase() === focusWord.toLowerCase()
        return (
          <span
            key={`${part}-${index}`}
            style={isFocus ? {
              color: tokens.primary,
              textDecoration: 'underline',
              textDecorationThickness: 2,
              fontWeight: 700,
            } : undefined}
          >
            {part}
          </span>
        )
      })}
    </div>
  )
}

function primaryBtnStyle(
  tokens: { primary: string; textInverse: string; glow: string; card: string; textMuted: string },
  disabled: boolean,
): React.CSSProperties {
  return {
    minHeight: 56,
    width: '100%',
    borderRadius: 12,
    border: 'none',
    background: disabled ? tokens.card : tokens.primary,
    color: disabled ? tokens.textMuted : tokens.textInverse,
    fontSize: 18,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : `0 4px 20px ${tokens.glow}`,
    transition: 'background 80ms ease, box-shadow 80ms ease',
  }
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
