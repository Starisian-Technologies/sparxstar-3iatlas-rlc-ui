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
import { StatsScreen } from './StatsScreen'
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
