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

vi.mock('@/api/client', () => ({
  api: {
    stats: {
      self: (...args: unknown[]) => selfMock(...args),
      leaderboard: (...args: unknown[]) => boardMock(...args),
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
}

const BOARD: LeaderboardResponse = {
  window: 'weekly',
  game_type: null,
  language: null,
  band: 'lower_basic',
  entries: [
    { rank: 1, screen_name: 'Awa', xp: 300, is_self: false, tied: false, movement: 'unchanged' },
    { rank: 2, screen_name: 'Modou', xp: 200, is_self: false, tied: true, movement: 'up' },
    { rank: 2, screen_name: 'Ndeye', xp: 200, is_self: false, tied: true, movement: 'down' },
    { rank: 4, screen_name: 'Fatou', xp: 120, is_self: true, tied: false, movement: 'unchanged' },
  ],
  next_cursor: null,
  scope: 'all_games',
  self_context: null,
  window_started_at: 0,
  generated_at: 0,
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

  it('preserves the server tie: two rows share rank 2, and says so', async () => {
    renderStats()
    await waitFor(() => expect(screen.getByText('Modou')).toBeTruthy())
    // Competition ranking arrives from the server; the client must not
    // renumber it into 1,2,3,4.
    expect(screen.getAllByLabelText('Joint 2')).toHaveLength(2)
    expect(screen.getByLabelText('Rank 4')).toBeTruthy()
    // The tie is in the ACCESSIBLE NAME, not only in a repeated glyph. A screen
    // reader hears one row at a time and never sees the repetition that tells a
    // sighted reader these two are level.
    expect(screen.queryByLabelText('Rank 2')).toBeNull()
  })

  it('names rank movement in words rather than by colour or arrow alone', async () => {
    renderStats()
    await waitFor(() => expect(screen.getByText('Modou')).toBeTruthy())
    // The fixture has Modou up and Ndeye down. A learner who cannot distinguish
    // the colours, or who is using a screen reader, gets the same information.
    expect(screen.getByLabelText('Moved up')).toBeTruthy()
    expect(screen.getByLabelText('Moved down')).toBeTruthy()
  })

  it('scopes the board to the player’s own skill band', async () => {
    renderStats()
    await waitFor(() => expect(boardMock).toHaveBeenCalled())
    const args = boardMock.mock.calls[0][0] as Record<string, unknown>
    expect(args.band).toBe('lower_basic')
  })

  it('shows a learner outside the page where they stand, not just the leaders', async () => {
    // THE ANTI-TOP-10 PROPERTY. A board a learner is not on tells them only
    // that they are not on it. The server sends their row and its neighbours;
    // this asserts the screen actually renders them.
    boardMock.mockResolvedValue({
      ...BOARD,
      entries: [
        { rank: 1, screen_name: 'Awa', xp: 300, is_self: false, tied: false, movement: 'unchanged' },
      ],
      self_context: [
        { rank: 11, screen_name: 'Binta', xp: 140, is_self: false, tied: false, movement: 'down' },
        { rank: 12, screen_name: 'Fatou', xp: 120, is_self: true, tied: false, movement: 'up' },
        { rank: 13, screen_name: 'Cherno', xp: 110, is_self: false, tied: false, movement: 'new' },
      ],
    })
    renderStats()
    await waitFor(() => expect(screen.getByText('Where you are')).toBeTruthy())
    expect(screen.getByLabelText('Rank 12')).toBeTruthy()
    // And the reachable competitor immediately above them.
    expect(screen.getByText('Binta')).toBeTruthy()
  })

  it('does not show a position block when the learner is already on the page', async () => {
    // The default fixture has Fatou on the page with is_self, and the server
    // therefore sends no context. Rendering one anyway would list them twice.
    renderStats()
    await waitFor(() => expect(screen.getByText('Fatou')).toBeTruthy())
    expect(screen.queryByText('Where you are')).toBeNull()
  })

  it('never receives or renders an account id on a board row', async () => {
    renderStats()
    await waitFor(() => expect(screen.getByText('Awa')).toBeTruthy())
    for (const entry of BOARD.entries) {
      expect(Object.keys(entry).sort()).toEqual(
        ['is_self', 'movement', 'rank', 'screen_name', 'tied', 'xp'].sort(),
      )
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
      entries: [{ rank: 5, screen_name: 'StaleWeekly', xp: 90, is_self: false, tied: false, movement: 'unchanged' }],
      next_cursor: null,
    }
    const ALL_TIME: LeaderboardResponse = {
      ...BOARD,
      window: 'all_time',
      entries: [{ rank: 1, screen_name: 'AllTimeTop', xp: 5000, is_self: false, tied: false, movement: 'unchanged' }],
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

})

describe('the period selector honours the radiogroup contract it advertises', () => {
  // Marking a group `role="radiogroup"` promises assistive technology a
  // specific interaction: one tab stop, arrows move AND select, Home/End jump.
  // It shipped with the role and none of the behaviour, so a screen reader told
  // the learner to press arrow keys and nothing happened. Pinning the behaviour
  // rather than the role, because the role is the part that was already there.

  it('moves and selects with arrow keys, and keeps a single tab stop', async () => {
    renderStats()
    await waitFor(() => expect(screen.getByText('Awa')).toBeTruthy())

    const weekly = screen.getByRole('radio', { name: 'This week' })
    const allTime = screen.getByRole('radio', { name: 'All time' })

    // One tab stop: the selected option holds it, the other is removed from
    // the tab order entirely.
    expect(weekly.getAttribute('tabindex')).toBe('0')
    expect(allTime.getAttribute('tabindex')).toBe('-1')

    fireEvent.keyDown(weekly, { key: 'ArrowRight' })
    await waitFor(() => expect(allTime.getAttribute('aria-checked')).toBe('true'))
    expect(weekly.getAttribute('aria-checked')).toBe('false')
    expect(allTime.getAttribute('tabindex')).toBe('0')

    // Wraps, rather than stopping at the end.
    fireEvent.keyDown(allTime, { key: 'ArrowRight' })
    await waitFor(() => expect(weekly.getAttribute('aria-checked')).toBe('true'))
  })

  it('jumps to first and last with Home and End', async () => {
    renderStats()
    await waitFor(() => expect(screen.getByText('Awa')).toBeTruthy())

    const weekly = screen.getByRole('radio', { name: 'This week' })
    const allTime = screen.getByRole('radio', { name: 'All time' })

    fireEvent.keyDown(weekly, { key: 'End' })
    await waitFor(() => expect(allTime.getAttribute('aria-checked')).toBe('true'))

    fireEvent.keyDown(allTime, { key: 'Home' })
    await waitFor(() => expect(weekly.getAttribute('aria-checked')).toBe('true'))
  })
})

describe('switching period reloads only the board', () => {
  it('does not refetch self-stats when the learner changes period', async () => {
    // Self-stats carries BOTH windows, so a period change needs no request for
    // the personal numbers. This lived in the same effect as the board, keyed on
    // the period, so every switch refetched them: two round trips where the
    // design says one, on the 2G links this platform targets.
    //
    // Counting CALLS is the assertion — the rendered output is identical either
    // way, so nothing else would catch a regression here.
    renderStats()
    await waitFor(() => expect(screen.getByText('Awa')).toBeTruthy())

    expect(selfMock).toHaveBeenCalledTimes(1)
    const boardCallsBefore = boardMock.mock.calls.length

    fireEvent.click(screen.getByRole('radio', { name: 'All time' }))
    await waitFor(() => expect(boardMock.mock.calls.length).toBeGreaterThan(boardCallsBefore))

    // The board reloaded; the learner's own numbers did not.
    expect(selfMock).toHaveBeenCalledTimes(1)
  })
})
