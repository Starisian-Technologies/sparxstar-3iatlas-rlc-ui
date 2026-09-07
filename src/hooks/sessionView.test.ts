/**
 * The client renders the server's rank. It does not compute one.
 *
 * `mergeSessionStatus` used to number the rows `idx + 1`. These tests exist
 * because that is invisible until two learners tie, and then it is wrong in
 * front of a classroom.
 */
import { describe, it, expect } from 'vitest'
import { mergeSessionStatus } from '@/hooks/sessionView'
import type { SessionStatusResponse } from '@/contract'

function status(
  leaderboard: SessionStatusResponse['leaderboard'],
): SessionStatusResponse {
  return {
    status: 'open',
    participant_count: leaderboard.length,
    token_count: 0,
    time_remaining_seconds: 600,
    class_xp_total: 0,
    leaderboard,
  }
}

describe('mergeSessionStatus leaderboard', () => {
  it('renders tied ranks as the server sent them, not as list positions', () => {
    const merged = mergeSessionStatus(
      's1',
      status([
        { participant_id: 'p1', screen_name: 'Ama', session_xp: 300, rank: 1, tied: false },
        { participant_id: 'p2', screen_name: 'Binta', session_xp: 200, rank: 2, tied: true },
        { participant_id: 'p3', screen_name: 'Cherno', session_xp: 200, rank: 2, tied: true },
        { participant_id: 'p4', screen_name: 'Dawda', session_xp: 100, rank: 4, tied: false },
      ]),
      undefined,
      null,
    )

    // Competition ranking, straight from the engine.
    expect(merged.leaderboard.map((e) => e.rank)).toEqual([1, 2, 2, 4])
    // `idx + 1` would have produced this instead — a second place and a third
    // conjured out of whichever tied row happened to arrive first.
    expect(merged.leaderboard.map((e) => e.rank)).not.toEqual([1, 2, 3, 4])
    expect(merged.leaderboard.map((e) => e.tied)).toEqual([false, true, true, false])
  })

  it('does not renumber a board whose ranks disagree with its order', () => {
    // A deliberately impossible-looking payload: if the client were deriving
    // ranks it would "fix" these into 1, 2. The server is the authority on the
    // whole population, including rows this page never received, so the client
    // must render what it is given.
    const merged = mergeSessionStatus(
      's1',
      status([
        { participant_id: 'p1', screen_name: 'Ama', session_xp: 90, rank: 7, tied: false },
        { participant_id: 'p2', screen_name: 'Binta', session_xp: 80, rank: 9, tied: false },
      ]),
      undefined,
      null,
    )
    expect(merged.leaderboard.map((e) => e.rank)).toEqual([7, 9])
  })

  it('carries the screen name through and never an account id', () => {
    const merged = mergeSessionStatus(
      's1',
      status([{ participant_id: 'p1', screen_name: 'Ama', session_xp: 10, rank: 1, tied: false }]),
      undefined,
      null,
    )
    expect(merged.leaderboard[0].display_name).toBe('Ama')
    expect(Object.keys(merged.leaderboard[0]).sort()).toEqual(
      ['display_name', 'participant_id', 'rank', 'tied', 'xp'].sort(),
    )
  })
})
