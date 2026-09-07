/**
 * Build a UI Session view by merging a wire SessionStatusResponse with
 * UI-side metadata (mode/language/join_code/collection_depth from join time)
 * and the previous Session (so metadata persists across status polls).
 *
 * Also remaps the wire leaderboard ({participant_id, screen_name, session_xp,
 * rank, tied}) to the UI shape ({participant_id, display_name, xp, rank,
 * tied}). It is a RENAME, not a calculation: rank and tie state come from the
 * engine, which is the only place that can see the whole population.
 *
 * This used to read `rank: idx + 1`. That is wrong the moment two learners are
 * level — it hands one of them second place and the other third on nothing but
 * the order the rows arrived in.
 */
import type { Session, LeaderboardEntry } from '@/types'
import type { SessionStatusResponse } from '@/contract'

export function mergeSessionStatus(
  session_id: string,
  status: SessionStatusResponse,
  meta: Partial<Session> | undefined,
  prev: Session | null,
): Session {
  const leaderboard: LeaderboardEntry[] = status.leaderboard.map((entry) => ({
    participant_id: entry.participant_id,
    display_name: entry.screen_name,
    xp: entry.session_xp,
    rank: entry.rank,
    tied: entry.tied,
  }))
  return {
    ...prev,
    ...meta,
    session_id,
    status: status.status,
    participant_count: status.participant_count,
    token_count: status.token_count,
    time_remaining_seconds: status.time_remaining_seconds,
    class_xp_total: status.class_xp_total,
    leaderboard,
  }
}
