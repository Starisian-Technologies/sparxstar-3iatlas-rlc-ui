/**
 * socket.ts — creates authenticated socket.io connections to the backend.
 *
 * URL resolution:
 *   Production: window.RLC_API_BASE = "https://backend.example/api/v1"
 *               → socket connects to "https://backend.example"
 *   Dev:        VITE_RLC_BACKEND_URL = "http://localhost:3001"
 *               → socket connects directly (not through the Vite /api proxy)
 *
 * Auth (spec §3.3):
 *   Student  → { token: participantToken }
 *   Teacher  → { role: 'teacher', token: teacherJWT, sessionId: string }
 */
import { io, type Socket } from 'socket.io-client'

export type SocketAuth =
  | { token: string }
  | { role: 'teacher'; token: string; sessionId: string }

function getSocketUrl(): string {
  const apiBase = (window as Record<string, unknown>)['RLC_API_BASE']
  if (typeof apiBase === 'string' && apiBase.length > 0) {
    try {
      const { protocol, host } = new URL(apiBase)
      return `${protocol}//${host}`
    } catch {
      // fall through
    }
  }
  // In dev, socket connects directly to the backend (not via the /api Vite proxy).
  return (import.meta.env['VITE_RLC_BACKEND_URL'] as string | undefined) ?? 'http://localhost:3001'
}

export function createSocket(auth: SocketAuth): Socket {
  return io(getSocketUrl(), {
    auth,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 10000,
  })
}
