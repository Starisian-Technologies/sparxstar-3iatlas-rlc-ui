import { getPendingSubmissions } from '@/runtime/offlineQueue'
import type { SaveTokenPayload } from '@/types'
import type { QueuedSubmission } from '@/runtime/offlineQueue'

export async function derivePendingCount(
  sessionId: string,
  pendingReader: (value: string) => Promise<QueuedSubmission[]> = getPendingSubmissions,
): Promise<number> {
  const remaining = await pendingReader(sessionId)
  return remaining.length
}

export function buildSyncPayload(payload: SaveTokenPayload): SaveTokenPayload {
  const payloadRecord = payload as unknown as { semantic_domain_id?: unknown }
  const semanticDomain = payloadRecord.semantic_domain_id
  if (typeof semanticDomain === 'string' && semanticDomain.trim() === '') {
    const sanitized = { ...payload } as SaveTokenPayload & { semantic_domain_id?: string }
    delete sanitized.semantic_domain_id
    return sanitized
  }
  return payload
}
