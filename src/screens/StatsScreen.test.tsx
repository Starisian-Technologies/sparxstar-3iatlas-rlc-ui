/**
 * Stats & Competition — the properties NODE-ADR-011 is conditional on.
 *
 * The leaderboard supersession was granted on four mitigations. Three of them
 * are client-observable, so they are pinned here rather than left to review:
 * the screen renders server numbers without recomputing them, it highlights the
 * caller's own row from the server's `is_self` (there are no account ids to
 * compare against), and opting out is offered without hiding the learner's own
 * standing from themselves.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StatsScreen } from '@/screens/StatsScreen'
import { ThemeProvider } from '@/theme/ThemeProvider'
import type { AccountStatsResponse, LeaderboardResponse } from '@/contract'
import '@/i18n'

const selfMock = vi.fn()
const boardMock = vi.fn()
const prefMock = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    stats: {
      self: (...args: unknown[]) => selfMock(...args),
      leaderboard: (...args: unknown[]) => boardMock(...args),
      setLeaderboardOptOut: (...args: unknown[]) => prefMock(...args),
    },
  },
}))

const ACCOUNT = '11111111-1111-4111-8111-111111111111'

const STATS: AccountStatsResponse = {
  account_id: ACCOUNT,
  screen_name: 'Fatou',
  band: 'lower_basic',
  weekly: { xp: 120, games_played: 4, accuracy: 0.75, rank: 3 },
  all_time: { xp: 980, games_played: 31, accuracy: 0.6125, rank: 7 },
  stars: 2,
  badges: 0,
  gold: 5,
  leaderboard_opt_out: false,
}

const BOARD: LeaderboardResponse = {
  window: 'weekly',
  game_type: null,
  language: null,
  band: 'lower_basic',
  entries: [
    { rank: 1, screen_name: 'Awa', xp: 300, is_self: false },
    { rank: 2, screen_name: 'Modou', xp: 200, is_self: false },
    { rank: 2, screen_name: 'Ndeye', xp: 200, is_self: false },
    { rank: 4, screen_name: 'Fatou', xp: 120, is_self: true },
  ],
  next_cursor: null,
}

function renderStats() {
  render(
    <ThemeProvider>
      <StatsScreen account_id={ACCOUNT} onBack={() => {}} />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  selfMock.mockResolvedValue(STATS)
  boardMock.mockResolvedValue(BOARD)
  prefMock.mockResolvedValue({ account_id: ACCOUNT, opt_out: true })
})

describe('stats screen renders server results only', () => {
  it('shows the rank the server computed, without deriving one', async () => {
    renderStats()
    // 3 is the server's weekly rank. It is NOT derivable from BOARD, where the
    // player sits at position 4 — so a screen that computed its own rank from
    // the visible rows would show #4 and fail here.
    await waitFor(() => expect(screen.getByText('#3')).toBeTruthy())
  })

  it('renders XP and games played verbatim', async () => {
    renderStats()
    // 120 appears twice by design: once as the player's own XP tile and once as
    // their row on the board. Both come from the server, neither is derived.
    await waitFor(() => expect(screen.getAllByText('120').length).toBeGreaterThan(0))
    expect(screen.getAllByText('120')).toHaveLength(2)
    expect(screen.getByText('4')).toBeTruthy()
  })

  it('renders a null accuracy as "—", never as 0%', async () => {
    selfMock.mockResolvedValue({
      ...STATS,
      weekly: { xp: 0, games_played: 0, accuracy: null, rank: null },
    })
    renderStats()
    await waitFor(() => expect(screen.getByText('—')).toBeTruthy())
    // 0% would tell a learner who has not played that they got everything wrong.
    expect(screen.queryByText('0%')).toBeNull()
  })

  it('says "not ranked yet" rather than inventing a last place', async () => {
    selfMock.mockResolvedValue({
      ...STATS,
      weekly: { xp: 0, games_played: 0, accuracy: null, rank: null },
    })
    renderStats()
    await waitFor(() => expect(screen.getByText('Not ranked yet')).toBeTruthy())
  })

  it('preserves the server tie: two rows share rank 2', async () => {
    renderStats()
    await waitFor(() => expect(screen.getByText('Modou')).toBeTruthy())
    // Competition ranking arrives from the server; the client must not
    // renumber it into 1,2,3,4.
    expect(screen.getAllByText('#2')).toHaveLength(2)
    expect(screen.getByText('#4')).toBeTruthy()
    expect(screen.queryByText('#3')).toBeTruthy() // the self-rank stat, not a row
  })

  it('scopes the board to the player’s own skill band', async () => {
    renderStats()
    await waitFor(() => expect(boardMock).toHaveBeenCalled())
    const args = boardMock.mock.calls[0][0] as Record<string, unknown>
    expect(args.band).toBe('lower_basic')
  })

  it('offers to hide the player from boards without hiding their own progress', async () => {
    selfMock.mockResolvedValue({ ...STATS, leaderboard_opt_out: true })
    renderStats()
    await waitFor(() => expect(screen.getByText('Show me on leaderboards')).toBeTruthy())
    // Their own rank is still on screen while they are hidden from the board.
    expect(screen.getByText('#3')).toBeTruthy()
  })

  it('sends the opt-out change to the server rather than hiding rows locally', async () => {
    renderStats()
    await waitFor(() => expect(screen.getByText('Hide me from leaderboards')).toBeTruthy())
    fireEvent.click(screen.getByText('Hide me from leaderboards'))
    await waitFor(() => expect(prefMock).toHaveBeenCalledWith(ACCOUNT, true))
  })

  it('never receives or renders an account id on a board row', async () => {
    renderStats()
    await waitFor(() => expect(screen.getByText('Awa')).toBeTruthy())
    for (const entry of BOARD.entries) {
      expect(Object.keys(entry).sort()).toEqual(['is_self', 'rank', 'screen_name', 'xp'])
    }
    expect(document.body.textContent).not.toContain(ACCOUNT)
  })
})

describe('a period change invalidates board requests already in flight', () => {
  // Both of these pin the same rule: a board response may only be applied if the
  // period that asked for it is still the period on screen. Without that check a
  // slow response lands on top of a board the player has already switched away
  // from, mixing weekly and all-time ranks in one list.

  it('drops a "load more" page that arrives after the player switched period', async () => {
    const WEEKLY_PAGE_1: LeaderboardResponse = { ...BOARD, next_cursor: 'cur-1' }
    const WEEKLY_PAGE_2: LeaderboardResponse = {
      ...BOARD,
      entries: [{ rank: 5, screen_name: 'StaleWeekly', xp: 90, is_self: false }],
      next_cursor: null,
    }
    const ALL_TIME: LeaderboardResponse = {
      ...BOARD,
      window: 'all_time',
      entries: [{ rank: 1, screen_name: 'AllTimeTop', xp: 5000, is_self: false }],
      next_cursor: null,
    }

    let releasePage2: (v: LeaderboardResponse) => void = () => {}
    const page2 = new Promise<LeaderboardResponse>((resolve) => {
      releasePage2 = resolve
    })

    boardMock.mockImplementation((args: { window: string; cursor?: string }) => {
      if (args.cursor) return page2
      return Promise.resolve(args.window === 'all_time' ? ALL_TIME : WEEKLY_PAGE_1)
    })

    renderStats()
    await waitFor(() => expect(screen.getByText('Awa')).toBeTruthy())

    // Ask for page 2 of the weekly board, then switch to all-time before it lands.
    fireEvent.click(screen.getByText('Show more'))
    fireEvent.click(screen.getByText('All time'))
    await waitFor(() => expect(screen.getByText('AllTimeTop')).toBeTruthy())

    releasePage2(WEEKLY_PAGE_2)
    await waitFor(() => expect(screen.queryByText('Show more')).toBeNull())

    // The weekly page must not have been appended to the all-time board.
    expect(screen.queryByText('StaleWeekly')).toBeNull()
    expect(screen.getByText('AllTimeTop')).toBeTruthy()
  })

  it('does not overwrite the new period with the board refreshed after an opt-out', async () => {
    const ALL_TIME: LeaderboardResponse = {
      ...BOARD,
      window: 'all_time',
      entries: [{ rank: 1, screen_name: 'AllTimeTop', xp: 5000, is_self: false }],
      next_cursor: null,
    }
    const WEEKLY_AFTER_OPT_OUT: LeaderboardResponse = {
      ...BOARD,
      entries: [{ rank: 1, screen_name: 'StaleWeekly', xp: 300, is_self: false }],
      next_cursor: null,
    }

    let releasePref: (v: { account_id: string; opt_out: boolean }) => void = () => {}
    prefMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releasePref = resolve
        }),
    )
    boardMock.mockImplementation((args: { window: string }) =>
      Promise.resolve(args.window === 'all_time' ? ALL_TIME : WEEKLY_AFTER_OPT_OUT),
    )

    renderStats()
    await waitFor(() => expect(screen.getByText('StaleWeekly')).toBeTruthy())

    fireEvent.click(screen.getByText('Hide me from leaderboards'))
    fireEvent.click(screen.getByText('All time'))
    await waitFor(() => expect(screen.getByText('AllTimeTop')).toBeTruthy())

    releasePref({ account_id: ACCOUNT, opt_out: true })

    // The all-time board stays on screen; the weekly refresh triggered by the
    // opt-out must not replace it.
    await waitFor(() => expect(boardMock.mock.calls.length).toBeGreaterThan(1))
    expect(screen.getByText('AllTimeTop')).toBeTruthy()
    expect(screen.queryByText('StaleWeekly')).toBeNull()
  })
})
