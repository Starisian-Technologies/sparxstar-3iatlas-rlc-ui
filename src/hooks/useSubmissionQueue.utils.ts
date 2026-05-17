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
  const semanticDomain = (payload as SaveTokenPayload & { semantic_domain_id?: unknown }).semantic_domain_id
  if (typeof semanticDomain === 'string' && semanticDomain.trim() === '') {
    const { semantic_domain_id, ...rest } = payload as SaveTokenPayload & { semantic_domain_id?: string }
    void semantic_domain_id
    return rest as SaveTokenPayload
  }
  return payload
}
