import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/theme/useTheme'

type Status = 'idle' | 'requesting' | 'recording' | 'uploading' | 'done' | 'error'

export interface RlcRecorderResult {
  yahura_transcription: string
  confidence: number
}

interface RlcRecorderProps {
  token_id: string
  session_id: string
  language: string
  word: string
  participant_token: string | null
  maxSeconds?: number
  onComplete: (result: RlcRecorderResult) => void
  onError?: (error: 'mic_denied' | 'upload_failed' | 'yahura_unavailable') => void
  onSkip: () => void
}

const YAHURA_BASE: string =
  (window as unknown as Record<string, unknown>)['YAHURA_URL'] as string | undefined ??
  (import.meta.env['VITE_YAHURA_URL'] as string | undefined) ??
  ''

const RLC_BASE: string =
  (window as unknown as Record<string, unknown>)['RLC_API_BASE'] as string | undefined ??
  '/api/v1'

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export function RlcRecorder({
  token_id,
  session_id,
  language,
  word,
  participant_token,
  maxSeconds = 5,
  onComplete,
  onError,
  onSkip,
}: RlcRecorderProps) {
  const { t } = useTranslation()
  const { tokens } = useTheme()
  const notSupported = typeof MediaRecorder === 'undefined'
  const [status, setStatus] = useState<Status>(notSupported ? 'error' : 'idle')
  const [elapsed, setElapsed] = useState(0)
  const [transcription, setTranscription] = useState('')
  const [errorMsg, setErrorMsg] = useState(
    notSupported ? 'Audio recording not supported in this browser — tap Skip.' : '',
  )
  const mountedRef = useRef(true)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
      if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
    }
  }, [])

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
  }

  async function startRecording() {
    if (!mountedRef.current) return
    setStatus('requesting')
    setErrorMsg('')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      if (!mountedRef.current) return
      const denied = err instanceof Error && err.name === 'NotAllowedError'
      const msg = denied ? 'Microphone blocked — tap Skip.' : 'Microphone unavailable — tap Skip.'
      setErrorMsg(msg)
      setStatus('error')
      onErrorRef.current?.('mic_denied')
      return
    }

    if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }

    const mimeType = getSupportedMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
      chunksRef.current = []
      if (!mountedRef.current) return
      setStatus('uploading')

      try {
        // Step 1: send audio directly to Yahura
        if (!YAHURA_BASE) throw new Error('yahura_unavailable')
        const form = new FormData()
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'
        form.append('audio', blob, `recording.${ext}`)
        form.append('token_id', token_id)
        form.append('session_id', session_id)
        form.append('language', language)

        const yahuraRes = await fetch(`${YAHURA_BASE}/v1/transcribe`, {
          method: 'POST',
          headers: participant_token ? { Authorization: `Participant ${participant_token}` } : {},
          body: form,
        })
        if (!yahuraRes.ok) throw new Error('yahura_unavailable')
        const { yahura_transcription, confidence } = await yahuraRes.json() as { yahura_transcription: string; confidence: number }
        // blob is now out of scope — GC collects it

        // Step 2: report result to node engine
        await fetch(`${RLC_BASE}/token/${token_id}/audio-routed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(participant_token ? { Authorization: `Participant ${participant_token}` } : {}),
          },
          body: JSON.stringify({ yahura_transcription, yahura_confidence: confidence }),
        })

        if (!mountedRef.current) return
        setTranscription(yahura_transcription)
        setStatus('done')
        await new Promise<void>(resolve => setTimeout(resolve, 1500))
        if (mountedRef.current) onCompleteRef.current({ yahura_transcription, confidence })
      } catch (err) {
        if (!mountedRef.current) return
        const isYahura = err instanceof Error && err.message === 'yahura_unavailable'
        setErrorMsg('Upload failed — tap Skip to continue.')
        setStatus('error')
        onErrorRef.current?.(isYahura ? 'yahura_unavailable' : 'upload_failed')
      }
    }

    recorder.start()
    setStatus('recording')
    setElapsed(0)

    timerRef.current = setInterval(() => {
      if (!mountedRef.current) return
      setElapsed(prev => {
        const next = prev + 1
        if (next >= maxSeconds) stopRecording()
        return Math.min(next, maxSeconds)
      })
    }, 1000)
  }

  const pct = Math.min(100, (elapsed / maxSeconds) * 100)
  const canRetry = status === 'error' && errorMsg === 'Upload failed — tap Skip to continue.'

  return (
    <div style={{
      background: tokens.card,
      border: `1.5px solid ${tokens.primarySoft}`,
      borderRadius: 14,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: tokens.textMuted, letterSpacing: 1, fontWeight: 700, textTransform: 'uppercase' }}>
          {t('recorder.say_this_word', { defaultValue: 'Say this word' })}
        </span>
        <button
          type="button"
          onClick={onSkip}
          disabled={status === 'uploading'}
          style={{ background: 'none', border: 'none', color: tokens.textMuted, fontSize: 13, cursor: 'pointer', padding: '4px 0' }}
        >
          {t('recorder.skip', { defaultValue: 'Skip' })}
        </button>
      </div>

      <div style={{ fontSize: 26, fontWeight: 900, color: tokens.primary, letterSpacing: -0.5 }}>
        {word}
      </div>

      {status === 'idle' && (
        <button
          type="button"
          onClick={() => void startRecording()}
          aria-label={t('recorder.start_label', { defaultValue: 'Start recording' })}
          style={actionBtnStyle(tokens.primary)}
        >
          <MicIcon /> {t('recorder.tap_to_record', { defaultValue: 'Tap to record' })}
        </button>
      )}

      {status === 'requesting' && (
        <p style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center', margin: 0, padding: '6px 0' }}>
          {t('recorder.getting_mic', { defaultValue: 'Getting microphone…' })}
        </p>
      )}

      {status === 'recording' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RecordingDot color={tokens.danger} />
            <div style={{
              flex: 1, height: 6,
              background: tokens.bg,
              borderRadius: 999,
              overflow: 'hidden',
              border: `1px solid ${tokens.border}`,
            }}>
              <div style={{
                height: '100%',
                borderRadius: 999,
                background: tokens.danger,
                width: `${pct}%`,
                transition: 'width 0.9s linear',
              }} />
            </div>
            <span style={{ fontSize: 12, color: tokens.textMuted, fontVariantNumeric: 'tabular-nums', minWidth: 20 }}>
              {elapsed}s
            </span>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            aria-label={t('recorder.stop_label', { defaultValue: 'Stop recording' })}
            style={actionBtnStyle(tokens.danger)}
          >
            <StopIcon /> {t('recorder.stop', { defaultValue: 'Stop' })}
          </button>
        </div>
      )}

      {status === 'uploading' && (
        <p style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center', margin: 0, padding: '6px 0' }}>
          {t('recorder.sending', { defaultValue: 'Sending…' })}
        </p>
      )}

      {status === 'done' && (
        <div style={{
          background: 'rgba(34,197,94,0.12)',
          border: `1px solid ${tokens.success}`,
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 14,
          color: tokens.success,
          fontWeight: 600,
        }}>
          ✓ &ldquo;{transcription}&rdquo;
        </div>
      )}

      {status === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 14, color: tokens.danger, margin: 0 }}>{errorMsg}</p>
          {canRetry && (
            <button type="button" onClick={() => void startRecording()} style={actionBtnStyle(tokens.primary)}>
              <MicIcon /> {t('recorder.try_again', { defaultValue: 'Try again' })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function actionBtnStyle(bg: string): React.CSSProperties {
  return {
    minHeight: 52,
    borderRadius: 12,
    border: 'none',
    background: bg,
    color: '#fff',
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  }
}

function RecordingDot({ color }: { color: string }) {
  return (
    <div style={{ position: 'relative', width: 14, height: 14, flexShrink: 0 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color, opacity: 0.35,
        animation: 'spx-sync-pulse 1.2s ease-in-out infinite',
      }} />
      <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', background: color }} />
    </div>
  )
}

function MicIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x={9} y={2} width={6} height={12} rx={3} />
      <path d="M5 10c0 3.866 3.134 7 7 7s7-3.134 7-7" />
      <line x1={12} y1={17} x2={12} y2={22} />
      <line x1={8} y1={22} x2={16} y2={22} />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x={4} y={4} width={16} height={16} rx={2} />
    </svg>
  )
}
