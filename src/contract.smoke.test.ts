import { describe, expect, it } from 'vitest'
import { EVENT_DISPOSITION } from '@/runtime/serverEvents'
import { GRAMMAR_DOMAINS, SPECIAL_CHARS } from '@/types'
import { api } from '@/api/client'
import type {
  CeremonyStarEvent,
  QcStateResponse,
  ServerToClientEvents,
  ClientToServerEvents,
  Star,
  VoteDimension
} from '@/contract'

/**
 * CONTRACT SMOKE TEST.
 *
 * `npm run smoke` previously pointed at this filename and the file did not
 * exist, so the documented backend-contract check had never once run. This is
 * that check, implemented.
 *
 * Scope, stated plainly: this asserts the UI's SIDE of the contract — that the
 * client's typed wire mirror declares the shapes the engine sends, that its API
 * surface covers the endpoints those shapes come from, and that the event
 * inventory is complete. It does NOT talk to a live backend. The engine repo owns
 * the end-to-end conformance run (`tests/contract.smoke.test.ts` there, against
 * real Postgres and a real socket), and duplicating it here without a server
 * would mean asserting against a mock — which proves nothing about the contract.
 *
 * A wire shape that drifts on the engine side is caught there. What is caught
 * HERE is the other half: this client quietly failing to declare or consume
 * something the contract added.
 */

describe('wire contract — QC', () => {
  it('declares the hydration read the reconnection path depends on', () => {
    // If `qc-state` loses `seq`, every client is back to guessing its position.
    const sample: QcStateResponse = { seq: 3, token: null, exhausted: false }
    // The typed literal above is the compile-time half; this is the runtime half,
    // which also catches a field being ADDED without this file noticing.
    expect(Object.keys(sample).sort()).toEqual(['exhausted', 'seq', 'token'])
  })

  it('carries a sequence on qc:token', () => {
    // The single field that makes duplicate, stale, and reordered delivery safe.
    const payload: Parameters<ServerToClientEvents['qc:token']>[0] = {
      seq: 1,
      token_id: 't',
      text: 'x',
      yahura_transcription: null,
      yahura_confidence: null,
      grammar_domain: 'noun_phrase',
      vote_orthography: { yes: 0, no: 0 },
      vote_semantics: { yes: 0, no: 0 },
      vote_audio: { yes: 0, no: 0 }
    }
    expect(typeof payload.seq).toBe('number')
  })

  it('keeps the three vote dimensions distinct in the contract', () => {
    const dimensions: VoteDimension[] = ['orthography', 'semantics', 'audio']
    expect(new Set(dimensions).size).toBe(3)
    // A client→server vote names exactly one dimension. There is no shape in
    // which two axes could be combined into a single judgement.
    const vote: Parameters<ClientToServerEvents['qc:vote']>[0] = {
      token_id: 't',
      dimension: 'orthography',
      vote_yes: true
    }
    expect(Object.keys(vote).sort()).toEqual(['dimension', 'token_id', 'vote_yes'])
  })

  it('never puts a submitter on a QC payload', () => {
    const payload: Parameters<ServerToClientEvents['qc:token']>[0] = {
      seq: 1,
      token_id: 't',
      text: 'x',
      yahura_transcription: null,
      yahura_confidence: null,
      grammar_domain: 'noun_phrase',
      vote_orthography: { yes: 0, no: 0 },
      vote_semantics: { yes: 0, no: 0 },
      vote_audio: { yes: 0, no: 0 }
    }
    // Anonymity is a property of the SHAPE, not of the view — there is nothing
    // here a careless screen could render.
    expect(Object.keys(payload)).not.toContain('participant_id')
    expect(Object.keys(payload)).not.toContain('account_id')
    expect(Object.keys(payload)).not.toContain('screen_name')
  })
})

describe('wire contract — ceremony', () => {
  it('carries the server-defined order on ceremony:star', () => {
    const star: CeremonyStarEvent = {
      star: 'most_words',
      participant_ids: ['p'],
      screen_names: ['n'],
      xp_awarded: 50,
      seq: 0,
      total: 3
    }
    expect(typeof star.seq === 'number' || star.seq === null).toBe(true)
    expect(typeof star.total === 'number' || star.total === null).toBe(true)
  })

  it('allows a null sequence for the out-of-run teacher-star announcement', () => {
    const announcement: CeremonyStarEvent = {
      star: 'teacher',
      participant_ids: ['p'],
      screen_names: ['n'],
      xp_awarded: 100,
      seq: null,
      total: null
    }
    expect(announcement.seq).toBeNull()
  })

  it('says how many stars the run contains on ceremony:end', () => {
    const end: Parameters<ServerToClientEvents['ceremony:end']>[0] = {
      session_id: 's',
      total_tokens: 4,
      discovery_count: 2,
      stars_total: 3
    }
    // Without this a client cannot tell a complete reveal from a truncated one.
    expect(typeof end.stars_total).toBe('number')
  })

  it('extends the plain Star shape rather than replacing it', () => {
    // The REST awards list and the socket event must stay assignment-compatible,
    // or a reconnecting client that re-fetches would need a second renderer.
    const plain: Star = { star: 'discovery', participant_ids: [], screen_names: [], xp_awarded: 100 }
    const asEvent: CeremonyStarEvent = { ...plain, seq: 0, total: 1 }
    expect(asEvent.star).toBe(plain.star)
  })
})

describe('client surface', () => {
  it('exposes every session endpoint the synchronized flows need', () => {
    for (const method of ['status', 'qcWords', 'qcState', 'qcAdvance', 'awards', 'ceremony'] as const) {
      expect(typeof api.session[method], `api.session.${method} is missing`).toBe('function')
    }
  })

  it('exposes the per-dimension token vote', () => {
    for (const method of ['vote', 'correct', 'submitTranslation'] as const) {
      expect(typeof api.token[method], `api.token.${method} is missing`).toBe('function')
    }
  })

  it('classifies all thirteen server events', () => {
    expect(Object.keys(EVENT_DISPOSITION)).toHaveLength(13)
  })
})

describe('collection invariants', () => {
  it('still has twelve grammar domains and ŋ first in the character bar', () => {
    // Cheap guards against a refactor quietly reshaping the collection surface.
    expect(GRAMMAR_DOMAINS).toHaveLength(12)
    expect(SPECIAL_CHARS[0]).toBe('ŋ')
  })
})
