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
  AccountStatsResponse,
  LeaderboardResponse,
  LeaderboardPreferenceResponse,
  LeaderboardQuery,
} from '@/contract'
import type { SaveTokenPayload } from '@/types'

const BASE =
  ((window as unknown as Record<string, unknown>)['RLC_API_BASE'] as string | undefined) ?? '/api/v1'

// ─── Participant token (in-memory only — never persisted) ─────────────────────

let _participantToken: string | null = null

export function setParticipantToken(token: string | null): void {
  _participantToken = token
}

/** The in-memory participant token, for the read surfaces that accept either
 *  principal. Null for an adult solo player, whose Identity token is used
 *  instead — `sessionReadHeaders` picks between them. */
function participantTokenForRead(): string | null {
  return _participantToken
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

/**
 * Credential for the session READ surfaces (`qc-words`, `qc-state`, `awards`).
 *
 * Those three return decrypted student writing, so the engine now requires either
 * a participant token for that session or a teacher/admin grant for its school.
 * A student passes their participant token; a teacher falls back to the injected
 * Identity token.
 */
export function sessionReadHeaders(participant_token?: string | null): Record<string, string> {
  if (participant_token) return { Authorization: `Participant ${participant_token}` }
  const token = getTeacherToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function teacherAuthHeaders(): Record<string, string> {
  const token = getTeacherToken()
  // Template literal, deliberately. A review bot reported this line as an
  // "unterminated template literal that will fail TypeScript parsing" and
  // rewrote it as concatenation; the report was a false positive — a secret
  // scanner had redacted the token interpolation to `******` in the diff the
  // reviewer read, and it mistook the redaction for the source. Typecheck, lint,
  // build, and CI were all green throughout, which a parse error makes
  // impossible. Restored for consistency with the rest of this file.
  return token ? { Authorization: `Bearer ${token}` } : {}
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

    async qcWords(session_id: string, participant_token?: string | null): Promise<QcToken[]> {
      const result = await request<QcWordsResponse>(`/session/${session_id}/qc-words`, {
        headers: sessionReadHeaders(participant_token)
      })
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
    qcState(session_id: string, participant_token?: string | null): Promise<QcStateResponse> {
      return request(`/session/${session_id}/qc-state`, { headers: sessionReadHeaders(participant_token) })
    },

    awards(session_id: string, participant_token?: string | null): Promise<AwardsResponse> {
      return request(`/session/${session_id}/awards`, { headers: sessionReadHeaders(participant_token) })
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

  /**
   * Stats and leaderboards (NODE-ADR-011). The engine computes every number
   * here; this client only fetches and renders. Never derive a rank, a total,
   * or a position on the client — a second scoring authority is exactly the
   * defect the server-authoritative rule exists to prevent.
   */
  stats: {
    /** The caller's own stats. Owner-only server-side; the id must be the
     *  account the presented credential names. */
    self(account_id: string): Promise<AccountStatsResponse> {
      return request(`/account/${account_id}/stats`, {
        headers: sessionReadHeaders(participantTokenForRead()),
      })
    },

    /** One page of a pseudonymous board. Every filter is optional and absent
     *  means "combined", which the response echoes back so the UI labels what
     *  it actually got rather than what it asked for. */
    leaderboard(q: LeaderboardQuery = {}): Promise<LeaderboardResponse> {
      const params = new URLSearchParams()
      if (q.window) params.set('window', q.window)
      if (q.game_type) params.set('game_type', q.game_type)
      if (q.language) params.set('language', q.language)
      if (q.band) params.set('band', q.band)
      if (q.limit !== undefined) params.set('limit', String(q.limit))
      if (q.cursor) params.set('cursor', q.cursor)
      const qs = params.toString()
      return request(`/leaderboard${qs ? `?${qs}` : ''}`, {
        headers: sessionReadHeaders(participantTokenForRead()),
      })
    },

    /** Withdraw from / rejoin public boards. Owner-only. */
    setLeaderboardOptOut(account_id: string, opt_out: boolean): Promise<LeaderboardPreferenceResponse> {
      return request(`/account/${account_id}/leaderboard-preference`, {
        method: 'PUT',
        headers: sessionReadHeaders(participantTokenForRead()),
        body: JSON.stringify({ opt_out }),
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
