import { useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { useTheme } from '@/theme/useTheme'
import type { AudioSubmitResponse } from '@/types'

type Status = 'idle' | 'requesting' | 'recording' | 'uploading' | 'done' | 'error'

interface RlcRecorderProps {
  token_id: string
  word: string
  participant_token: string | null
  /** Maximum recording length in seconds (default 5). */
  maxSeconds?: number
  onComplete: (result: AudioSubmitResponse) => void
  onSkip: () => void
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export function RlcRecorder({
  token_id,
  word,
  participant_token,
  maxSeconds = 5,
  onComplete,
  onSkip,
}: RlcRecorderProps) {
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
      setErrorMsg(denied ? 'Microphone blocked — tap Skip.' : 'Microphone unavailable — tap Skip.')
      setStatus('error')
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
        const result = await api.token.submitAudio(token_id, blob, participant_token)
        if (!mountedRef.current) return
        setTranscription(result.yahura_transcription)
        setStatus('done')
        await new Promise<void>(resolve => setTimeout(resolve, 1500))
        if (mountedRef.current) onCompleteRef.current(result)
      } catch {
        if (!mountedRef.current) return
        setErrorMsg('Upload failed — tap Skip to continue.')
        setStatus('error')
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
          Say this word
        </span>
        <button
          type="button"
          onClick={onSkip}
          disabled={status === 'uploading'}
          style={{ background: 'none', border: 'none', color: tokens.textMuted, fontSize: 13, cursor: 'pointer', padding: '4px 0' }}
        >
          Skip
        </button>
      </div>

      <div style={{ fontSize: 26, fontWeight: 900, color: tokens.primary, letterSpacing: -0.5 }}>
        {word}
      </div>

      {status === 'idle' && (
        <button
          type="button"
          onClick={() => void startRecording()}
          aria-label="Start recording"
          style={actionBtnStyle(tokens.primary)}
        >
          <MicIcon /> Tap to record
        </button>
      )}

      {status === 'requesting' && (
        <p style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center', margin: 0, padding: '6px 0' }}>
          Getting microphone…
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
            aria-label="Stop recording"
            style={actionBtnStyle(tokens.danger)}
          >
            <StopIcon /> Stop
          </button>
        </div>
      )}

      {status === 'uploading' && (
        <p style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center', margin: 0, padding: '6px 0' }}>
          Sending…
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
              <MicIcon /> Try again
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
