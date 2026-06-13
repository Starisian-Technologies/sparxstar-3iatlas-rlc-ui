/**
 * UI type surface.
 *
 * Wire types come from `@/contract` (the typed mirror of the markdown contract,
 * byte-identical to the node engine repo). This file re-exports them under the
 * names existing UI code uses, and adds UI-only types (offline queue payloads,
 * Session view aggregate, app state, RSC grammar domains, etc.).
 */

// ─── Wire types (re-exported from the contract) ──────────────────────────────

export type {
  Mode as CollectionMode,
  Tier as StudentTier,
  CollectionDepth,
  SessionStatus,
  SpellingSignal,
  SaturationSignal,
  CompletenessSignal,
  VoteDimension,
  StarKind,
  Rights,
  VoteCount,
  VoteCounts,
  // Sessions
  SessionCreateRequest as CreateSessionPayload,
  SessionCreateResponse as CreateSessionResponse,
  SessionJoinRequest as JoinSessionPayload,
  SessionJoinResponse as JoinSessionResponse,
  JoinRosterResponse,
  SessionStatusResponse,
  QcAdvanceResponse,
  // Tokens
  TokenSaveRequest,
  TokenSaveResponse as SaveTokenResponse,
  VoteRequest as VotePayload,
  VoteResponse,
  TranslateRequest,
  CorrectRequest,
  QcToken,
  QcWordsResponse,
  // Awards / ceremony
  Star,
  AwardsResponse,
  TeachersStarRequest,
  // School / class / account
  SchoolResponse,
  ClassResponse,
  AccountCreateRequest,
  AccountCreateResponse,
  AccountXpResponse,
  // Events
  BatchEvent,
  BatchEventType,
  BatchRequest,
  BatchResponse,
  // Sockets
  ServerToClientEvents,
  ClientToServerEvents,
  StudentHandshakeAuth,
  TeacherHandshakeAuth,
  // Errors
  ErrorBody,
  CredentialInvalidBody,
  AccountLockedBody,
  RateLimitedBody,
  ScreenTimeExceededBody,
  UnknownScreenNameBody,
} from '@/contract'

import type {
  Mode,
  CollectionDepth,
  SessionStatus,
  TokenSaveRequest as WireTokenSaveRequest,
  SessionStatusResponse,
  SpellingSignal,
} from '@/contract'

// ─── UI session view (aggregate of join data + status poll) ──────────────────
// The wire SessionStatusResponse only carries live counters and status.
// Metadata like join_code/mode/language/collection_depth comes once at join.
// The UI merges them into this view object so screens have a single source.

export interface Session extends Omit<SessionStatusResponse, 'leaderboard'> {
  session_id: string
  /** From SessionCreateResponse on the teacher side, from join code on student side. */
  join_code?: string
  /** Set at join/create time, immutable for the session. */
  mode?: Mode
  language?: string
  locale?: string
  semantic_domain_id?: string
  duration_minutes?: number
  collection_depth?: CollectionDepth
  started_at?: number
  /** Status is required from the wire; everything else is UI-aggregated. */
  status: SessionStatus
  /** UI-flattened leaderboard with display_name/xp aliases for backward compat. */
  leaderboard: LeaderboardEntry[]
}

/**
 * UI leaderboard view — the wire shape carries { participant_id, screen_name,
 * session_xp }; the UI maps to display_name/xp so existing screens compile.
 * Rank is derived UI-side (the wire returns the list already sorted).
 */
export interface LeaderboardEntry {
  participant_id: string
  display_name: string
  xp: number
  rank: number
}

// ─── Offline queue payload (UI-only) ─────────────────────────────────────────
// The wire TokenSaveRequest doesn't carry participant_id (derived from bearer).
// The offline queue needs participant_id to scope queued items, so the queue
// payload type wraps the wire body with the scoping field. api.token.save()
// strips it before sending.

export type SaveTokenPayload = WireTokenSaveRequest & {
  participant_id: string
}

// ─── Awards UI extras ────────────────────────────────────────────────────────

export interface Participant {
  participant_id: string
  display_name: string
  is_teacher: boolean
  xp: number
  gold: number
  connected: boolean
}

// ─── Grammar domains (RSC) — UI-only, drives the slug→index map ──────────────

export interface GrammarDomain {
  index: number
  slug: string
  label: string
  prompt: string
  focus_element: string
}

export const GRAMMAR_DOMAINS: GrammarDomain[] = [
  { index: 1,  slug: 'noun_phrase',   label: 'Noun phrase',   prompt: 'Name the person or thing doing the action.',          focus_element: 'subject noun' },
  { index: 2,  slug: 'verb_phrase',   label: 'Verb phrase',   prompt: 'Describe what someone is doing.',                     focus_element: 'main verb' },
  { index: 3,  slug: 'adjective',     label: 'Adjective',     prompt: 'Describe what something looks like or feels like.',   focus_element: 'describing word' },
  { index: 4,  slug: 'adverb',        label: 'Adverb',        prompt: 'Describe how someone does something.',                focus_element: 'manner word' },
  { index: 5,  slug: 'possession',    label: 'Possession',    prompt: 'Say who owns something.',                             focus_element: 'possessive word' },
  { index: 6,  slug: 'numeric',       label: 'Numeric',       prompt: 'Describe how many of something there are.',           focus_element: 'number or quantity' },
  { index: 7,  slug: 'interjection',  label: 'Interjection',  prompt: 'Express surprise, greeting, or emotion.',             focus_element: 'exclamation' },
  { index: 8,  slug: 'conjunction',   label: 'Conjunction',   prompt: 'Connect two thoughts with and, but, or because.',     focus_element: 'connecting word' },
  { index: 9,  slug: 'classifier',    label: 'Classifier',    prompt: 'Name what kind of thing this is.',                    focus_element: 'classifier word' },
  { index: 10, slug: 'question',      label: 'Question',      prompt: 'Ask a question about something in the domain.',       focus_element: 'question word' },
  { index: 11, slug: 'formal',        label: 'Formal',        prompt: 'Greet an elder or teacher respectfully.',             focus_element: 'respect marker' },
  { index: 12, slug: 'informal',      label: 'Informal',      prompt: 'Greet a friend your own age.',                        focus_element: 'casual marker' },
]

export function grammarDomainIndexBySlug(slug: string): number {
  return GRAMMAR_DOMAINS.find((d) => d.slug === slug)?.index ?? 1
}

// ─── Special characters ─────────────────────────────────────────────────────

export const SPECIAL_CHARS = ['ŋ', 'ɓ', 'ɗ', 'ñ', 'ɲ', 'ʔ'] as const
export type SpecialChar = typeof SPECIAL_CHARS[number]

// ─── App state ──────────────────────────────────────────────────────────────

export type AppRole = 'none' | 'teacher' | 'student'

export interface AppState {
  role: AppRole
  session_id: string | null
  participant_id: string | null
  /** HMAC participant token — kept in memory only, never persisted. */
  participant_token: string | null
  join_code: string | null
  display_name: string | null
  mode: import('@/contract').Mode | null
  collection_depth: import('@/contract').CollectionDepth | null
  language: string | null
}

export interface SubmittedWord {
  id: string
  word: string
  translation?: string
  xp_awarded: number
  /** Queue sync state — 'queued' until server confirms, then 'synced' */
  syncStatus: 'queued' | 'synced'
  /** Set when the server responds with the canonical token ID */
  token_id?: string
  /** Confidence signal from the server spelling check */
  spelling_signal?: SpellingSignal
}

/**
 * Session-complete summary shown to students after QC starts.
 * There are no rounds in the data model — this is a per-session summary.
 */
export interface SessionCompleteSummary {
  words_collected: number
  points_earned: number
  stars_earned: number
  top_words: SubmittedWord[]
  player_score: number
  player_rank: number
  total_players: number
}

