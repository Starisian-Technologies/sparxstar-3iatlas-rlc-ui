// ─── Session ────────────────────────────────────────────────────────────────

export type CollectionMode = 'rwc' | 'rsc'
export type CollectionDepth = 'full' | 'translation_only' | 'basic'
export type SessionStatus = 'open' | 'closed' | 'archived' | 'qc' | 'ceremony'

export interface Session {
  session_id: string
  join_code: string
  mode: CollectionMode
  language: string
  semantic_domain_id: string
  duration_minutes: number
  collection_depth: CollectionDepth
  status: SessionStatus
  started_at: number
  participant_count: number
  token_count: number
  time_remaining_seconds: number
  current_round?: number
  total_rounds?: number
  round_status?: 'waiting' | 'active' | 'complete'
  round_goal?: number
  next_round_starts_in_seconds?: number
  leaderboard: LeaderboardEntry[]
  participants?: Participant[]
}

export interface CreateSessionPayload {
  mode: CollectionMode
  language: string
  semantic_domain_id: string
  duration_minutes: number
  collection_depth: CollectionDepth
}

export interface CreateSessionResponse {
  session_id: string
  join_code: string
  qr_code_url?: string
}

export interface JoinSessionResponse {
  session_id: string
  participant_id: string
  display_name?: string
  language: string
  mode: CollectionMode
  collection_depth: CollectionDepth
}

// ─── Token (Submission) ──────────────────────────────────────────────────────

export type SpellingSignal = 'confirmed' | 'variant' | 'discovery'
export type SaturationSignal = 'ok' | 'saturated'

export interface SaveTokenPayload {
  session_id: string
  participant_id: string
  text: string
  translation?: string
  collection_mode: CollectionMode
  grammar_domain?: string
}

export interface SaveTokenResponse {
  token_id: string
  spelling_signal: SpellingSignal
  saturation_signal: SaturationSignal
  spelling_score: number
  xp_awarded: number
}

export interface QcToken {
  token_id: string
  text: string
  translation?: string
  xp_awarded?: number
  created_at?: number
  corrected_text?: string
  spelling_signal: SpellingSignal
  spelling_score: number
  vote_orthography: { yes: number; no: number }
  vote_semantics: { yes: number; no: number }
  vote_audio: { yes: number; no: number }
  qc_translations: Array<{ participant_id: string; translation: string }>
  submitter_id: string
  collection_mode?: CollectionMode
  grammar_domain?: string
  /** True when submission has audio AND passed the QC vote — spec §8.2 */
  speaker_affirmed?: boolean
}

export interface VotePayload {
  dimension: 'orthography' | 'semantics' | 'audio'
  vote_yes: boolean
}

export interface VoteResponse {
  success: boolean
  vote_counts: { yes: number; no: number }
}

// ─── Awards ──────────────────────────────────────────────────────────────────

export interface Star {
  category: string
  label: string
  participant_id: string
  display_name: string
  gold_bonus: number
}

export interface AwardsResponse {
  stars: Star[]
  leaderboard: LeaderboardEntry[]
  total_tokens: number
  discovery_count: number
}

export interface LeaderboardEntry {
  participant_id: string
  display_name: string
  xp: number
  gold: number
  rank: number
  is_teacher: boolean
}

// ─── Participant ─────────────────────────────────────────────────────────────

export interface Participant {
  participant_id: string
  display_name: string
  is_teacher: boolean
  xp: number
  gold: number
  connected: boolean
}

// ─── Grammar domains (RSC) ───────────────────────────────────────────────────

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

// ─── Special characters ───────────────────────────────────────────────────────

export const SPECIAL_CHARS = ['ŋ', 'ɓ', 'ɗ', 'ñ', 'ɲ', 'ʔ'] as const
export type SpecialChar = typeof SPECIAL_CHARS[number]

// ─── App state ────────────────────────────────────────────────────────────────

export type AppRole = 'none' | 'teacher' | 'student'

export interface AppState {
  role: AppRole
  session_id: string | null
  participant_id: string | null
  join_code: string | null
  display_name: string | null
  mode: CollectionMode | null
  collection_depth: CollectionDepth | null
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

export interface RoundCompleteSummary {
  round: number
  total_rounds: number
  words_collected: number
  points_earned: number
  stars_earned: number
  top_words: SubmittedWord[]
  player_score: number
  player_rank: number
  total_players: number
}
