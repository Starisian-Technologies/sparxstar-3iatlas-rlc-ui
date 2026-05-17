import { getPendingSubmissions } from '@/runtime/offlineQueue'
import type { SaveTokenPayload } from '@/types'
import type { QueuedSubmission } from '@/runtime/offlineQueue'

type SaveTokenPayloadWithSemanticDomain = SaveTokenPayload & {
  semantic_domain_id?: unknown
}

export async function derivePendingCount(
  sessionId: string,
  pendingReader: (value: string) => Promise<QueuedSubmission[]> = getPendingSubmissions,
): Promise<number> {
  const remaining = await pendingReader(sessionId)
  return remaining.length
}

export function buildSyncPayload(payload: SaveTokenPayload): SaveTokenPayload {
  const payloadRecord = payload as SaveTokenPayloadWithSemanticDomain
  const semanticDomain = payloadRecord.semantic_domain_id
  if (typeof semanticDomain === 'string' && semanticDomain.trim() === '') {
    const sanitized = { ...payloadRecord }
    delete sanitized.semantic_domain_id
    return sanitized as SaveTokenPayload
  }
  return payload
}
