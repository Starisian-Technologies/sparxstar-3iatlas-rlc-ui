/**
 * REST API client for the sparxstar-3iatlas-rlc-node-engine Node backend.
 * All calls go to /api/v1/ (the backend's REST prefix).
 *
 * In production, `window.RLC_API_BASE` is injected by the orchestrator
 * (or whatever host page mounts this app). For local development, Vite
 * proxies /api/* to VITE_RLC_BACKEND_URL.
 */

import type {
  AuthLoginPayload,
  AuthLoginResponse,
  CreateSessionPayload,
  CreateSessionResponse,
  JoinSessionPayload,
  JoinSessionResponse,
  SaveTokenPayload,
  SaveTokenResponse,
  VotePayload,
  VoteResponse,
  QcToken,
  AwardsResponse,
  Session,
} from '@/types'
import type { RlcEvent } from '@/runtime/rlcEventTypes'

export type EventsBatchFlushResponse = {
  accepted: number
  failed: number
  accepted_event_ids?: string[]
}

// Base URL — injected by the host page or falls back to the Vite dev proxy
const BASE = (window as unknown as Record<string, unknown>)['RLC_API_BASE'] as string ?? '/api/v1'

// ─── Participant token (in-memory only, never persisted) ──────────────────────

let _participantToken: string | null = null

export function setParticipantToken(token: string | null): void {
  _participantToken = token
}

function participantAuthHeaders(): Record<string, string> {
  return _participantToken ? { Authorization: `Participant ${_participantToken}` } : {}
}

/**
 * Teacher endpoints require a backend-issued JWT. The host page injects
 * `window.RLC_TEACHER_TOKEN` after the teacher authenticates via Helios.
 * For local dev, localStorage.RLC_TEACHER_TOKEN is accepted as a fallback.
 */
function getTeacherToken(): string | null {
  if (typeof window === 'undefined') return null
  const fromWindow = (window as unknown as Record<string, unknown>)['RLC_TEACHER_TOKEN']
  if (typeof fromWindow === 'string' && fromWindow.length > 0) return fromWindow
  try {
    const fromStorage = window.localStorage.getItem('RLC_TEACHER_TOKEN')
    return fromStorage && fromStorage.length > 0 ? fromStorage : null
  } catch {
    return null
  }
}

function teacherAuthHeaders(): Record<string, string> {
  const token = getTeacherToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Teacher auth is Helios JWT (RS256/JWKS) — injected by the orchestrator.
// The login endpoint does not exist; this stub is retained for local dev
// token-entry flows only.

export const api = {
  auth: {
    /** Dev-only: exchange credentials for a Helios-compatible token. Not a real backend endpoint. */
    login(payload: AuthLoginPayload): Promise<AuthLoginResponse> {
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
  },

  // ─── Session ───────────────────────────────────────────────────────────────

  session: {
    create(payload: CreateSessionPayload): Promise<CreateSessionResponse> {
      return request('/session/create', {
        method: 'POST',
        headers: teacherAuthHeaders(),
        body: JSON.stringify(payload),
      })
    },

    // Tier-aware join (spec §6.3):
    //   Lower Basic  — first call: { join_code } only → server returns session_screen_names roster
    //                  second call: { join_code, screen_name } → returns participant token
    //   Upper Basic  — { join_code, screen_name, pin }
    //   SS / Adult   — { join_code, screen_name, password }
    async join(payload: JoinSessionPayload): Promise<JoinSessionResponse> {
      const result = await request<JoinSessionResponse>('/session/join', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (result.participant_token) {
        setParticipantToken(result.participant_token)
      }
      return result
    },

    async status(session_id: string): Promise<Session> {
      const result = await request<Session & { participant_token?: string }>(`/session/${session_id}/status`)
      // Silently refresh participant token when server rotates it near expiry
      if (result.participant_token) {
        setParticipantToken(result.participant_token)
      }
      return result
    },

    close(session_id: string): Promise<void> {
      return request(`/session/${session_id}/close`, {
        method: 'POST',
        headers: teacherAuthHeaders(),
      })
    },

    qcWords(session_id: string): Promise<QcToken[]> {
      return request<{ qc_words: QcToken[] }>(`/session/${session_id}/qc-words`)
        .then((data) => data.qc_words)
    },

    awards(session_id: string): Promise<AwardsResponse> {
      return request(`/session/${session_id}/awards`)
    },

    assignTeacherStar(session_id: string, participant_id: string): Promise<void> {
      return request(`/session/${session_id}/teachers-star`, {
        method: 'POST',
        headers: teacherAuthHeaders(),
        body: JSON.stringify({ participant_id }),
      })
    },
  },

  token: {
    save(payload: SaveTokenPayload): Promise<SaveTokenResponse> {
      return request('/token/save', {
        method: 'POST',
        headers: participantAuthHeaders(),
        body: JSON.stringify(payload),
      })
    },

    vote(token_id: string, payload: VotePayload): Promise<VoteResponse> {
      return request(`/token/${token_id}/vote`, {
        method: 'POST',
        headers: participantAuthHeaders(),
        body: JSON.stringify(payload),
      })
    },

    submitTranslation(token_id: string, translation: string): Promise<void> {
      return request(`/token/${token_id}/translate`, {
        method: 'POST',
        headers: participantAuthHeaders(),
        body: JSON.stringify({ translation }),
      })
    },

    correct(token_id: string, corrected_text: string): Promise<void> {
      return request(`/token/${token_id}/correct`, {
        method: 'POST',
        headers: participantAuthHeaders(),
        body: JSON.stringify({ corrected_text }),
      })
    },
  },

  // ─── Events batch ──────────────────────────────────────────────────────────
  // POST /events/batch — flush queued runtime events (spec §7.4).
  // Events are append-only; the server never modifies or deletes them.

  events: {
    batchFlush(events: RlcEvent[]): Promise<EventsBatchFlushResponse> {
      return request('/events/batch', {
        method: 'POST',
        headers: participantAuthHeaders(),
        body: JSON.stringify({ events }),
      })
    },
  },
}
