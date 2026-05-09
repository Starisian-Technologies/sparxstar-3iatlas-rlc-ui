import { useState, useRef, useEffect } from 'react'
import { api } from '@/api/client'
import { AccessoryBar } from '@/components/AccessoryBar'
import type { CollectionDepth, SaveTokenResponse } from '@/types'
import { useSessionPoll } from '@/hooks/useSessionPoll'

interface RwcCollectionScreenProps {
  session_id: string
  participant_id: string
  collection_depth: CollectionDepth
  language: string
  onSubmitted: (result: SaveTokenResponse) => void
  onCollectionEnded: () => void
}

type Step = 'word' | 'translation' | 'recording' | 'done'

/**
 * S2 — Student RWC collection screen.
 * Three sequential panels: word → translation → recording.
 * Submit only active when required steps for the selected depth are complete.
 * Special character bar is always visible above keyboard.
 */
export function RwcCollectionScreen({
  session_id, participant_id, collection_depth, language, onSubmitted, onCollectionEnded,
}: RwcCollectionScreenProps) {
  const [step, setStep] = useState<Step>('word')
  const [word, setWord] = useState('')
  const [translation, setTranslation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<SaveTokenResponse | null>(null)
  const { session } = useSessionPoll(session_id, true)
  const wordRef = useRef<HTMLInputElement>(null)
  const translationRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (session?.status && session.status !== 'open') {
      onCollectionEnded()
    }
  }, [onCollectionEnded, session?.status])

  const insertChar = (char: string) => {
    const ref = step === 'word' ? wordRef : translationRef
    const el = ref.current
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const newVal = el.value.slice(0, start) + char + el.value.slice(end)
    if (step === 'word') setWord(newVal)
    else setTranslation(newVal)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + char.length
      el.focus()
    })
  }

  const needsTranslation = collection_depth !== 'basic'
  const needsRecording = collection_depth === 'full'

  const canProceedFromWord = word.trim().length > 0
  const canProceedFromTranslation = translation.trim().length > 0

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.token.save({
        session_id, participant_id,
        text: word.trim(),
        translation: needsTranslation ? translation.trim() : undefined,
        collection_mode: 'rwc',
      })
      setLastResult(result)
      onSubmitted(result)
      // Reset for next word
      setWord('')
      setTranslation('')
      setStep('word')
    } catch {
      setError('Could not submit. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f4f4f4' }}>

      {/* Progress indicator */}
      <div style={{
        background: '#1B3A6B', padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <StepDot active={step === 'word'} done={step !== 'word'} label="Word" />
        {needsTranslation && (
          <StepDot
            active={step === 'translation'}
            done={step === 'recording' || step === 'done'}
            label="Translation"
          />
        )}
        {needsRecording && (
          <StepDot active={step === 'recording'} done={step === 'done'} label="Record" />
        )}
      </div>

      {/* Last result feedback */}
      {lastResult && (
        <div style={{
          background: lastResult.saturation_signal === 'saturated'
            ? '#fff7e4'
            : lastResult.spelling_signal === 'discovery'
              ? '#eaf3de'
              : '#e6f1fb',
          padding: '10px 20px', fontSize: 13,
          color: lastResult.saturation_signal === 'saturated'
            ? '#8a6208'
            : lastResult.spelling_signal === 'discovery'
              ? '#3b6d11'
              : '#0c447c',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>
            {lastResult.saturation_signal === 'saturated' && 'Great! We have lots of that word — try a different one. '}
            {lastResult.spelling_signal === 'discovery' && '⭐ New discovery! '}
            {lastResult.spelling_signal === 'confirmed' && '✓ Word confirmed. '}
            {lastResult.spelling_signal === 'variant' && '~ Spelling variant noted. '}
            +{lastResult.xp_awarded} XP
          </span>
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Step: Word */}
        {step === 'word' && (
          <>
            <label style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>
              Type a word in {language}
            </label>
            <input
              ref={wordRef}
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoFocus
              placeholder="Type a word…"
              style={inputStyle}
              aria-label="Word input"
            />
            <button
              type="button"
              disabled={!canProceedFromWord}
              onClick={() => setStep(needsTranslation ? 'translation' : needsRecording ? 'recording' : 'done')}
              style={btnStyle(!canProceedFromWord)}
            >
              {needsTranslation ? 'Next →' : 'Submit'}
            </button>
          </>
        )}

        {/* Step: Translation */}
        {step === 'translation' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B' }}>"{word}"</div>
            <label style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>
              What does it mean in English or French?
            </label>
            <input
              ref={translationRef}
              type="text"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              autoFocus
              placeholder="Translation…"
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setStep('word')} style={backBtnStyle}>
                ← Back
              </button>
              <button
                type="button"
                disabled={!canProceedFromTranslation}
                onClick={() => setStep(needsRecording ? 'recording' : 'done')}
                style={{ ...btnStyle(!canProceedFromTranslation), flex: 1 }}
              >
                {needsRecording ? 'Next →' : 'Submit'}
              </button>
            </div>
          </>
        )}

        {/* Step: Recording — placeholder, will mount @sparxstar/starmus-audio */}
        {step === 'recording' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B' }}>"{word}"</div>
            <label style={{ fontSize: 16, fontWeight: 600 }}>
              Record yourself saying the word
            </label>
            <div style={{
              border: '2px dashed #b4b2a9', borderRadius: 12,
              padding: 40, textAlign: 'center', color: '#888',
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
            }}>
              <div style={{ fontSize: 48 }}>🎙</div>
              <div style={{ fontSize: 14 }}>
                Starmus recorder mounts here
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                (@sparxstar/starmus-audio — to be wired in)
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setStep(needsTranslation ? 'translation' : 'word')} style={backBtnStyle}>
                ← Back
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={loading}
                style={{ ...btnStyle(loading), flex: 1 }}
              >
                {loading ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </>
        )}

        {/* Step: Done (basic mode submits here) */}
        {step === 'done' && !loading && (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            style={btnStyle(false)}
          >
            Submit word
          </button>
        )}

        {error && (
          <div role="alert" style={{
            background: '#ffeded', border: '1px solid #f09595',
            borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#a32d2d',
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Special character bar — always at bottom above keyboard */}
      <AccessoryBar onInsert={insertChar} />
    </div>
  )
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
        background: done ? '#C9A84C' : active ? '#ffffff' : 'rgba(255,255,255,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700,
        color: done ? '#1B3A6B' : active ? '#1B3A6B' : 'transparent',
      }}>
        {done ? '✓' : '●'}
      </div>
      <div style={{ fontSize: 12, color: active ? '#ffffff' : 'rgba(255,255,255,0.5)', fontWeight: active ? 600 : 400 }}>
        {label}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: 20, padding: '14px 16px',
  border: '2px solid #b4b2a9', borderRadius: 10,
  boxSizing: 'border-box', outline: 'none',
}

const btnStyle = (disabled: boolean): React.CSSProperties => ({
  minHeight: 52, fontSize: 18, fontWeight: 700,
  background: disabled ? '#b4b2a9' : '#1B3A6B',
  color: '#ffffff', border: 'none', borderRadius: 10,
  cursor: disabled ? 'not-allowed' : 'pointer', width: '100%',
})

const backBtnStyle: React.CSSProperties = {
  minHeight: 52, fontSize: 16, fontWeight: 600,
  background: '#ffffff', color: '#1a1a1a',
  border: '2px solid #b4b2a9', borderRadius: 10,
  cursor: 'pointer', padding: '0 20px',
}
