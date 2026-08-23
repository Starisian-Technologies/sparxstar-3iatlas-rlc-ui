/**
 * REST API client for the sparxstar-3iatlas-rlc-node-engine backend.
 * All calls go to /api/v1/ (the backend's REST prefix).
 *
 * In production, `window.RLC_API_BASE` is injected by the orchestrator.
 * For local development, Vite proxies /api/* to VITE_RLC_BACKEND_URL.
 *
 * Wire shapes are defined in src/contract.ts (byte-identical mirror of the
 * markdown contract committed to both repos).
 */

import type {
  SessionCreateRequest,
  SessionCreateResponse,
  SessionJoinRequest,
  SessionJoinResponse,
  JoinRosterResponse,
  SessionStatusResponse,
  QcAdvanceResponse,
  QcToken,
  QcWordsResponse,
  QcStateResponse,
  TokenSaveRequest,
  TokenSaveResponse,
  VoteRequest,
  VoteResponse,
  AwardsResponse,
  TeachersStarRequest,
  SchoolResponse,
  ClassResponse,
  BatchEvent,
  BatchResponse,
} from '@/contract'
import type { SaveTokenPayload } from '@/types'

const BASE =
  ((window as unknown as Record<string, unknown>)['RLC_API_BASE'] as string | undefined) ?? '/api/v1'

// ─── Participant token (in-memory only — never persisted) ─────────────────────

let _participantToken: string | null = null

export function setParticipantToken(token: string | null): void {
  _participantToken = token
}

function participantAuthHeaders(): Record<string, string> {
  return _participantToken ? { Authorization: `Participant ${_participantToken}` } : {}
}

// ─── Teacher token ───────────────────────────────────────────────────────────
//
// An Identity-issued token, supplied by the host page at runtime and held in
// page memory only — never persisted, never minted here. Whether its holder can
// do anything is decided server-side against RLC's authorization records; this
// token proves identity, not authority.

/**
 * The teacher's token, or null. Exported because the socket handshake needs the
 * same value the REST headers use — three files had grown their own copy of this
 * four-line function, which is three chances for them to disagree about where
 * the token lives.
 */
export function getTeacherToken(): string | null {
  if (typeof window === 'undefined') return null
  const fromWindow = (window as unknown as Record<string, unknown>)['RLC_TEACHER_TOKEN']
  return typeof fromWindow === 'string' && fromWindow.length > 0 ? fromWindow : null
}

function teacherAuthHeaders(): Record<string, string> {
  const token = getTeacherToken()
  return token ? { Authorization: 'Bearer ' + token } : {}
}

// ─── Core fetch wrapper ─────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

// ─── API surface ────────────────────────────────────────────────────────────

export const api = {
  // School / class metadata — used for the recording gate when the
  // full-depth slice is built. Both teacher-auth.
  school: {
    get(school_id: string): Promise<SchoolResponse> {
      return request(`/school/${school_id}`, { headers: teacherAuthHeaders() })
    },
  },
  class: {
    get(class_id: string): Promise<ClassResponse> {
      return request(`/class/${class_id}`, { headers: teacherAuthHeaders() })
    },
  },

  session: {
    create(payload: SessionCreateRequest): Promise<SessionCreateResponse> {
      return request('/session/create', {
        method: 'POST',
        headers: teacherAuthHeaders(),
        body: JSON.stringify(payload),
      })
    },

    // Tier-aware join (contract §3.4):
    //   Lower Basic — first call: { join_code } only → server returns
    //                 { requires_screen_name, session_screen_names }
    //                 second call: { join_code, screen_name } → SessionJoinResponse
    //   Upper Basic — { join_code, screen_name, pin } → SessionJoinResponse
    //   SS / Adult  — { join_code, screen_name, password } → SessionJoinResponse
    async join(
      payload: SessionJoinRequest,
    ): Promise<SessionJoinResponse | JoinRosterResponse> {
      const result = await request<SessionJoinResponse | JoinRosterResponse>('/session/join', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if ('participant_token' in result && result.participant_token) {
        setParticipantToken(result.participant_token)
      }
      return result
    },

    async status(session_id: string): Promise<SessionStatusResponse> {
      const result = await request<SessionStatusResponse>(`/session/${session_id}/status`, {
        headers: participantAuthHeaders(),
      })
      if (result.participant_token) setParticipantToken(result.participant_token)
      return result
    },

    close(session_id: string): Promise<{ success: true }> {
      return request(`/session/${session_id}/close`, {
        method: 'POST',
        headers: teacherAuthHeaders(),
      })
    },

    qcAdvance(session_id: string): Promise<QcAdvanceResponse> {
      return request(`/session/${session_id}/qc-advance`, {
        method: 'POST',
        headers: teacherAuthHeaders(),
      })
    },

    async qcWords(session_id: string): Promise<QcToken[]> {
      const result = await request<QcWordsResponse>(`/session/${session_id}/qc-words`)
      return result.qc_words
    },

    /**
     * The authoritative current QC position.
     *
     * This is HYDRATION, not progression: it is how a client that has just
     * mounted, reloaded, or reconnected finds out where the class is. It never
     * advances anything — only the teacher's `qcAdvance` does that — so a
     * student calling it repeatedly changes nothing for anyone.
     */
    qcState(session_id: string): Promise<QcStateResponse> {
      return request(`/session/${session_id}/qc-state`)
    },

    awards(session_id: string): Promise<AwardsResponse> {
      return request(`/session/${session_id}/awards`)
    },

    ceremony(session_id: string): Promise<{ success: true }> {
      return request(`/session/${session_id}/ceremony`, {
        method: 'POST',
        headers: teacherAuthHeaders(),
      })
    },

    assignTeacherStar(session_id: string, participant_id: string): Promise<{ success: true }> {
      const body: TeachersStarRequest = { participant_id }
      return request(`/session/${session_id}/teachers-star`, {
        method: 'POST',
        headers: teacherAuthHeaders(),
        body: JSON.stringify(body),
      })
    },
  },

  token: {
    /**
     * Save a token. Accepts a UI `SaveTokenPayload` (which carries a UI-side
     * `participant_id` for offline-queue scoping); the participant_id is
     * stripped before sending — the server derives it from the bearer token.
     */
    save(payload: SaveTokenPayload): Promise<TokenSaveResponse> {
      const { participant_id: _scopeId, ...wireBody } = payload
      void _scopeId
      return request('/token/save', {
        method: 'POST',
        headers: participantAuthHeaders(),
        body: JSON.stringify(wireBody as TokenSaveRequest),
      })
    },

    vote(token_id: string, payload: VoteRequest): Promise<VoteResponse> {
      return request(`/token/${token_id}/vote`, {
        method: 'POST',
        headers: participantAuthHeaders(),
        body: JSON.stringify(payload),
      })
    },

    submitTranslation(token_id: string, translation: string): Promise<{ success: true }> {
      return request(`/token/${token_id}/translate`, {
        method: 'POST',
        headers: participantAuthHeaders(),
        body: JSON.stringify({ translation }),
      })
    },

    correct(token_id: string, corrected_text: string): Promise<{ success: true }> {
      return request(`/token/${token_id}/correct`, {
        method: 'POST',
        headers: participantAuthHeaders(),
        body: JSON.stringify({ corrected_text }),
      })
    },
  },

  events: {
    batchFlush(events: BatchEvent[]): Promise<BatchResponse> {
      return request('/events/batch', {
        method: 'POST',
        headers: participantAuthHeaders(),
        body: JSON.stringify({ events }),
      })
    },
  },
}
