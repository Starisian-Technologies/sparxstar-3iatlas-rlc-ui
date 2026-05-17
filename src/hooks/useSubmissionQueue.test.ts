import { describe, expect, it } from 'vitest'
import { buildSyncPayload, derivePendingCount } from './useSubmissionQueue.utils'
import type { QueuedSubmission } from '@/runtime/offlineQueue'
import type { SaveTokenPayload } from '@/types'

describe('useSubmissionQueue pending count derivation', () => {
  it('derives pending count from queue size each time', async () => {
    const bySession: Record<string, QueuedSubmission[]> = {
      'session-1': [1, 2, 3].map((n) => ({ id: String(n) } as QueuedSubmission)),
    }

    const reader = async (sessionId: string) => bySession[sessionId] ?? []

    expect(await derivePendingCount('session-1', reader)).toBe(3)

    bySession['session-1'] = [{ id: '4' } as QueuedSubmission]
    expect(await derivePendingCount('session-1', reader)).toBe(1)

    bySession['session-1'] = []
    expect(await derivePendingCount('session-1', reader)).toBe(0)
  })
})

type SaveTokenPayloadWithSemanticDomain = SaveTokenPayload & {
  semantic_domain_id?: string | null
}

describe('useSubmissionQueue payload sanitation', () => {
  const basePayload: SaveTokenPayload = {
    session_id: 'session-1',
    participant_id: 'participant-1',
    text: 'token',
    collection_mode: 'rwc',
  }

  it('omits semantic_domain_id when nullish', () => {
    const payload = { ...basePayload, semantic_domain_id: null } as SaveTokenPayloadWithSemanticDomain
    const result = buildSyncPayload(payload)
    expect((result as SaveTokenPayloadWithSemanticDomain).semantic_domain_id).toBeUndefined()
  })

  it('omits semantic_domain_id when empty string', () => {
    const payload = { ...basePayload, semantic_domain_id: '   ' } as SaveTokenPayloadWithSemanticDomain
    const result = buildSyncPayload(payload)
    expect((result as SaveTokenPayloadWithSemanticDomain).semantic_domain_id).toBeUndefined()
  })

  it('keeps semantic_domain_id when non-empty', () => {
    const payload = { ...basePayload, semantic_domain_id: 'domain-1' } as SaveTokenPayloadWithSemanticDomain
    const result = buildSyncPayload(payload)
    expect((result as SaveTokenPayloadWithSemanticDomain).semantic_domain_id).toBe('domain-1')
  })
})
