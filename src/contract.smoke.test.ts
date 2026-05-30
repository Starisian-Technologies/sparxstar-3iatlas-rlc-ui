/**
 * Contract smoke test — verifies a live `sparxstar-3iatlas-rlc` backend matches
 * the shapes this UI actually sends and expects (see src/api/client.ts and
 * src/types/index.ts, and docs/specs/INTEGRATION-CONTRACT.md).
 *
 * It is SKIPPED unless RLC_SMOKE_BASE is set, so `npm test` / CI stay green.
 *
 * Usage:
 *   RLC_SMOKE_BASE=https://backend.example/api/v1 npm run smoke
 *
 * Optional env (each check skips, rather than fails, when its inputs are absent):
 *   RLC_SMOKE_TOKEN          Bearer token for teacher endpoints
 *   RLC_SMOKE_SESSION_ID     existing session id (status / qc-words / awards)
 *   RLC_SMOKE_JOIN_CODE      open session join code (exercises /session/join)
 *   RLC_SMOKE_PARTICIPANT_ID participant id (token/save)
 *   RLC_SMOKE_WRITE=1        opt in to write checks (create, token/save, events/batch)
 */
import { describe, it, expect } from 'vitest'
import { RlcEventType } from '@/runtime/rlcEventTypes'

const base = (process.env.RLC_SMOKE_BASE ?? '').replace(/\/$/, '')
const token = process.env.RLC_SMOKE_TOKEN ?? ''
const allowWrite = process.env.RLC_SMOKE_WRITE === '1'

// Shared across the sequential checks below.
const ctx: {
  sessionId: string
  joinCode: string
  participantId: string
  tokenId: string
} = {
  sessionId: process.env.RLC_SMOKE_SESSION_ID ?? '',
  joinCode: process.env.RLC_SMOKE_JOIN_CODE ?? '',
  participantId: process.env.RLC_SMOKE_PARTICIPANT_ID ?? '',
  tokenId: '',
}

type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array'
interface FieldSpec {
  type: FieldType
  enum?: readonly (string | number)[]
}
type Schema = Record<string, FieldSpec>

function typeOf(value: unknown): FieldType | 'undefined' | 'null' {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'array'
  const t = typeof value
  return t === 'object' || t === 'string' || t === 'number' || t === 'boolean'
    ? (t as FieldType)
    : 'object'
}

/** Returns a list of human-readable contract violations (empty = pass). */
function checkShape(label: string, value: unknown, required: Schema): string[] {
  const problems: string[] = []
  if (typeOf(value) !== 'object') {
    return [`${label}: expected an object, got ${typeOf(value)}`]
  }
  const obj = value as Record<string, unknown>

  // Envelope detection — the UI consumes responses unwrapped (risk F).
  if ('success' in obj && 'data' in obj) {
    problems.push(
      `${label}: looks enveloped ({ success, data, ... }); UI expects the payload unwrapped`,
    )
  }

  for (const [key, spec] of Object.entries(required)) {
    const actual = typeOf(obj[key])
    if (actual === 'undefined' || actual === 'null') {
      problems.push(`${label}.${key}: missing (UI requires ${spec.type})`)
      continue
    }
    if (actual !== spec.type) {
      problems.push(`${label}.${key}: expected ${spec.type}, got ${actual}`)
      continue
    }
    if (spec.enum && !spec.enum.includes(obj[key] as string | number)) {
      problems.push(
        `${label}.${key}: ${JSON.stringify(obj[key])} not in [${spec.enum.join(', ')}]`,
      )
    }
  }
  return problems
}

/** Logs UI-degrades-without warnings for type-optional but consumed fields. */
function warnMissing(label: string, value: unknown, fields: string[]): void {
  if (typeOf(value) !== 'object') return
  const obj = value as Record<string, unknown>
  for (const f of fields) {
    const t = typeOf(obj[f])
    if (t === 'undefined' || t === 'null') {
      console.warn(`⚠️  ${label}.${f} absent — dependent UI will degrade to defaults`)
    }
  }
}

interface CallResult {
  status: number
  body: unknown
  raw: string
}

async function call(path: string, init: RequestInit = {}): Promise<CallResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers, ...((init.headers as Record<string, string>) ?? {}) },
  })
  const raw = await res.text()
  let body: unknown
  try {
    body = raw ? JSON.parse(raw) : undefined
  } catch {
    body = undefined
  }
  return { status: res.status, body, raw }
}

function assertOk(label: string, r: CallResult): void {
  expect(r.status, `${label}: HTTP ${r.status} — ${r.raw.slice(0, 200)}`).toBeLessThan(300)
}

const run = base ? describe : describe.skip

run('RLC backend contract', () => {
  it('reports the base URL under test', () => {
    expect(base).toBeTruthy()
    console.log(`Smoke base: ${base} (write=${allowWrite}, auth=${token ? 'yes' : 'no'})`)
  })

  it('POST /session/create → CreateSessionResponse', async (t) => {
    if (!allowWrite || !token) {
      t.skip() // needs RLC_SMOKE_WRITE=1 and a teacher token
      return
    }
    const r = await call('/session/create', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'rwc',
        language: 'mandinka',
        semantic_domain_id: 'smoke-test',
        duration_minutes: 5,
        collection_depth: 'basic',
      }),
    })
    assertOk('create', r)
    expect(checkShape('create', r.body, { session_id: { type: 'string' }, join_code: { type: 'string' } })).toEqual([])
    const b = r.body as Record<string, string>
    ctx.sessionId = ctx.sessionId || b.session_id
    ctx.joinCode = ctx.joinCode || b.join_code
  })

  it('POST /session/join → JoinSessionResponse', async (t) => {
    if (!ctx.joinCode) {
      t.skip() // provide RLC_SMOKE_JOIN_CODE or run create first
      return
    }
    const r = await call('/session/join', {
      method: 'POST',
      body: JSON.stringify({ join_code: ctx.joinCode, display_name: 'Smoke Tester' }),
    })
    assertOk('join', r)
    expect(
      checkShape('join', r.body, {
        session_id: { type: 'string' },
        participant_id: { type: 'string' },
        language: { type: 'string' },
        mode: { type: 'string', enum: ['rwc', 'rsc'] },
        collection_depth: { type: 'string', enum: ['full', 'translation_only', 'basic'] },
      }),
    ).toEqual([])
    const b = r.body as Record<string, string>
    ctx.sessionId = ctx.sessionId || b.session_id
    ctx.participantId = ctx.participantId || b.participant_id
  })

  it('GET /session/{id}/status → Session', async (t) => {
    if (!ctx.sessionId) {
      t.skip() // provide RLC_SMOKE_SESSION_ID
      return
    }
    const r = await call(`/session/${ctx.sessionId}/status`)
    assertOk('status', r)
    expect(
      checkShape('status', r.body, {
        status: { type: 'string', enum: ['open', 'closed', 'archived', 'qc', 'ceremony'] },
        participant_count: { type: 'number' },
        token_count: { type: 'number' },
        time_remaining_seconds: { type: 'number' },
        leaderboard: { type: 'array' },
      }),
    ).toEqual([])
    // UI-consumed but type-optional — warn (does not fail) so drift is visible.
    warnMissing('status', r.body, [
      'current_round',
      'total_rounds',
      'round_goal',
      'semantic_domain_id',
    ])
    const lb = (r.body as { leaderboard?: unknown[] }).leaderboard
    if (Array.isArray(lb) && lb.length > 0) {
      expect(
        checkShape('status.leaderboard[0]', lb[0], {
          participant_id: { type: 'string' },
          display_name: { type: 'string' },
          xp: { type: 'number' },
          rank: { type: 'number' },
        }),
      ).toEqual([])
      warnMissing('status.leaderboard[0]', lb[0], ['gold', 'is_teacher'])
    }
  })

  it('GET /session/{id}/qc-words → QcToken[]', async (t) => {
    if (!ctx.sessionId) {
      t.skip()
      return
    }
    const r = await call(`/session/${ctx.sessionId}/qc-words`)
    assertOk('qc-words', r)
    expect(Array.isArray(r.body), 'qc-words: expected an array').toBe(true)
    const arr = r.body as unknown[]
    if (arr.length > 0) {
      expect(
        checkShape('qc-words[0]', arr[0], {
          token_id: { type: 'string' },
          text: { type: 'string' },
          spelling_signal: { type: 'string', enum: ['confirmed', 'variant', 'discovery'] },
          spelling_score: { type: 'number' },
          vote_orthography: { type: 'object' },
          vote_semantics: { type: 'object' },
          qc_translations: { type: 'array' },
          submitter_id: { type: 'string' },
        }),
      ).toEqual([])
      ctx.tokenId = ctx.tokenId || (arr[0] as { token_id: string }).token_id
    }
  })

  it('GET /session/{id}/awards → AwardsResponse', async (t) => {
    if (!ctx.sessionId) {
      t.skip()
      return
    }
    const r = await call(`/session/${ctx.sessionId}/awards`)
    assertOk('awards', r)
    expect(
      checkShape('awards', r.body, {
        stars: { type: 'array' },
        leaderboard: { type: 'array' },
        total_tokens: { type: 'number' },
        discovery_count: { type: 'number' },
      }),
    ).toEqual([])
    const stars = (r.body as { stars?: unknown[] }).stars
    if (Array.isArray(stars) && stars.length > 0) {
      expect(
        checkShape('awards.stars[0]', stars[0], {
          category: { type: 'string' },
          label: { type: 'string' },
          participant_id: { type: 'string' },
          display_name: { type: 'string' },
          gold_bonus: { type: 'number' },
        }),
      ).toEqual([])
    }
  })

  it('POST /token/save → SaveTokenResponse', async (t) => {
    if (!allowWrite || !ctx.sessionId || !ctx.participantId) {
      t.skip() // needs RLC_SMOKE_WRITE=1 + session + participant
      return
    }
    const r = await call('/token/save', {
      method: 'POST',
      body: JSON.stringify({
        session_id: ctx.sessionId,
        participant_id: ctx.participantId,
        text: 'smoke-test-word',
        collection_mode: 'rwc',
      }),
    })
    assertOk('token/save', r)
    expect(
      checkShape('token/save', r.body, {
        token_id: { type: 'string' },
        spelling_signal: { type: 'string', enum: ['confirmed', 'variant', 'discovery'] },
        saturation_signal: { type: 'string', enum: ['continue', 'saturated'] },
        spelling_score: { type: 'number' },
        xp_awarded: { type: 'number' },
      }),
    ).toEqual([])
  })

  it('POST /events/batch → EventsBatchFlushResponse', async (t) => {
    if (!allowWrite || !ctx.sessionId || !ctx.participantId) {
      t.skip()
      return
    }
    const event = {
      event_id: crypto.randomUUID(),
      event_type: RlcEventType.RLC_SYNC_QUEUED,
      session_id: ctx.sessionId,
      participant_id: ctx.participantId,
      emitted_at: Date.now(),
      sequence: 1,
      payload: { source: 'contract-smoke-test' },
    }
    const r = await call('/events/batch', {
      method: 'POST',
      body: JSON.stringify({ events: [event] }),
    })
    assertOk('events/batch', r)
    expect(
      checkShape('events/batch', r.body, {
        accepted: { type: 'number' },
        failed: { type: 'number' },
      }),
    ).toEqual([])
  })
})
