import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api/client'
import type { QcToken, Session } from '@/types'

interface UseQcSessionResult {
  qcWords: QcToken[]
  currentIndex: number
  currentToken: QcToken | null
  session: Session | null
  loading: boolean
  error: string | null
  setCurrentIndex: (index: number) => void
  refreshStatus: () => Promise<void>
}

/**
 * QC session state:
 * - load qc words once (fixed ordered list)
 * - poll /session/{id}/status every 2 seconds
 */
export function useQcSession(session_id: string | null): UseQcSessionResult {
  const [qcWords, setQcWords] = useState<QcToken[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshStatus = useCallback(async () => {
    if (!session_id) return
    try {
      const status = await api.session.status(session_id)
      setSession(status)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh QC status')
    }
  }, [session_id])

  useEffect(() => {
    let active = true
    if (!session_id) return
    setLoading(true)
    void (async () => {
      try {
        const words = await api.session.qcWords(session_id)
        if (!active) return
        setQcWords(words)
        setError(null)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Could not load QC words')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [session_id])

  useEffect(() => {
    if (!session_id) return
    void refreshStatus()
    intervalRef.current = setInterval(() => void refreshStatus(), 2000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refreshStatus, session_id])

  const currentToken = useMemo(
    () => qcWords[currentIndex] ?? null,
    [currentIndex, qcWords],
  )

  return {
    qcWords,
    currentIndex,
    currentToken,
    session,
    loading,
    error,
    setCurrentIndex,
    refreshStatus,
  }
}
