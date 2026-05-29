/**
 * API client for sparxstar-3iatlas-rlc WordPress plugin.
 * All calls go to /aiwa/v1/ — the plugin's REST namespace.
 *
 * During local development, Vite proxies these calls to VITE_WP_URL.
 * In production, set the base URL via the RLC_API_BASE window variable
 * injected by the WordPress plugin's asset loader.
 */

import type {
  CreateSessionPayload,
  CreateSessionResponse,
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

// Base URL — injected by WordPress or falls back to Vite proxy
const BASE =
  (window as unknown as Record<string, string>)['RLC_API_BASE'] ??
  '/aiwa/v1'

/**
 * Teacher endpoints (`session/create`, `session/{id}/close`, `teachers-star`)
 * require a Helios Bearer token. The plugin's asset loader is expected to inject
 * `window.RLC_TEACHER_TOKEN` after the teacher authenticates. For local dev,
 * `localStorage.RLC_TEACHER_TOKEN` is used as a fallback so a developer can set
 * the token once via the browser console.
 *
 * The UI never talks to Helios directly (AGENTS.md: "No direct downstream
 * integrations").
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

// ─── Session ─────────────────────────────────────────────────────────────────

export const api = {
  session: {
    create(payload: CreateSessionPayload): Promise<CreateSessionResponse> {
      return request('/session/create', {
        method: 'POST',
        headers: teacherAuthHeaders(),
        body: JSON.stringify(payload),
      })
    },

    join(join_code: string, display_name: string): Promise<JoinSessionResponse> {
      return request('/session/join', {
        method: 'POST',
        body: JSON.stringify({ join_code, display_name }),
      })
    },

    status(session_id: string): Promise<Session> {
      return request(`/session/${session_id}/status`)
    },

    close(session_id: string): Promise<void> {
      return request(`/session/${session_id}/close`, {
        method: 'POST',
        headers: teacherAuthHeaders(),
      })
    },

    qcWords(session_id: string): Promise<QcToken[]> {
      return request(`/session/${session_id}/qc-words`)
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
        body: JSON.stringify(payload),
      })
    },

    vote(token_id: string, participant_id: string, payload: VotePayload): Promise<VoteResponse> {
      return request(`/token/${token_id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ ...payload, participant_id }),
      })
    },

    submitTranslation(token_id: string, participant_id: string, translation: string): Promise<void> {
      return request(`/token/${token_id}/translate`, {
        method: 'POST',
        body: JSON.stringify({ translation, participant_id }),
      })
    },

    correct(token_id: string, participant_id: string, corrected_text: string): Promise<void> {
      return request(`/token/${token_id}/correct`, {
        method: 'POST',
        body: JSON.stringify({ corrected_text, participant_id }),
      })
    },
  },

  // ─── Events batch ───────────────────────────────────────────────────────────
  // POST /events/batch — flush queued runtime events (spec §7.4).
  // Events are append-only; the server never modifies or deletes them.

  events: {
    batchFlush(events: RlcEvent[]): Promise<EventsBatchFlushResponse> {
      return request('/events/batch', {
        method: 'POST',
        body: JSON.stringify({ events }),
      })
    },
  },
}
