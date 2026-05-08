import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/api/client'
import type { Session } from '@/types'

/**
 * Polls session status every 2 seconds.
 * Used during the collection phase to keep teacher monitor
 * and student screens in sync without WebSockets.
 */
export function useSessionPoll(session_id: string | null, enabled = true) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    if (!session_id) return
    try {
      const data = await api.session.status(session_id)
      setSession(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Poll failed')
    }
  }, [session_id])

  useEffect(() => {
    if (!enabled || !session_id) return

    void poll()
    intervalRef.current = setInterval(() => void poll(), 2000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [session_id, enabled, poll])

  return { session, error, refresh: poll }
}
