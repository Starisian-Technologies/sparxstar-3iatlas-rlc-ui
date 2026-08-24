import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { CeremonyScreen } from './CeremonyScreen'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { socketRegistry } from '@/test/fakeSocket'

/**
 * SYNCHRONIZED CEREMONY, asserted at screen level.
 *
 * The defect: `ceremony:star` and `ceremony:end` were emitted and unheard, so
 * each browser fetched the awards, sorted them against a hardcoded local order,
 * and revealed them on its own `setInterval`. Thirty students watched thirty
 * ceremonies. These tests lock in the server's authority over order and over
 * when the ceremony ends.
 */

vi.mock('@/runtime/socket', async () => {
  const { createTrackedSocket } = await import('@/test/fakeSocket')
  return { createSocket: createTrackedSocket }
})

const h = vi.hoisted(() => ({
  awards: {
    stars: [] as Array<{
      star: string
      participant_ids: string[]
      screen_names: string[]
      xp_awarded: number
    }>,
    leaderboard: [] as Array<{ participant_id: string; screen_name: string; tokens: number; session_xp: number }>,
    total_tokens: 0,
    discovery_count: 0
  }
}))

vi.mock('@/api/client', () => ({
  getTeacherToken: () => 'teacher-token',
  api: { session: { awards: async () => JSON.parse(JSON.stringify(h.awards)) } }
}))

function star(kind: string, name: string, xp = 50) {
  return { star: kind, participant_ids: [`p-${name}`], screen_names: [name], xp_awarded: xp }
}

/** A `ceremony:star` broadcast: the award plus its place in the server's run. */
function starEvent(kind: string, name: string, seq: number | null, total: number | null) {
  return { ...star(kind, name), seq, total }
}

/**
 * Let effects and timers land before asserting something did NOT change.
 *
 * `waitFor` is wrong for a negative assertion: its first check runs before the
 * re-render, so it resolves against the pre-event DOM and passes whether or not
 * the bug is present.
 */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60))
  })
}

function renderCeremony(props: Partial<Parameters<typeof CeremonyScreen>[0]> = {}) {
  return render(
    <ThemeProvider>
      <CeremonyScreen
        session_id="sess-1"
        onReturnToSession={() => {}}
        auth={{ token: 'ptok' }}
        revealIntervalMs={5}
        {...props}
      />
    </ThemeProvider>
  )
}

beforeEach(() => {
  socketRegistry.reset()
  h.awards = {
    stars: [],
    leaderboard: [{ participant_id: 'p-Ama', screen_name: 'Ama', tokens: 3, session_xp: 30 }],
    total_tokens: 4,
    discovery_count: 2
  }
})

describe('the ceremony follows the server', () => {
  it('renders stars in the order the server numbered them', async () => {
    renderCeremony()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()

    // Deliberately delivered out of order. Display order must come from `seq`,
    // not from arrival and not from a local list.
    socket.server.emit('ceremony:star', starEvent('discovery', 'Binta', 2, 3))
    socket.server.emit('ceremony:star', starEvent('most_words', 'Ama', 0, 3))
    socket.server.emit('ceremony:star', starEvent('best_spelling', 'Chike', 1, 3))
    socket.server.emit('ceremony:end', {
      session_id: 'sess-1',
      total_tokens: 4,
      discovery_count: 2,
      stars_total: 3
    })

    await waitFor(() => expect(screen.getByText('Ama')).toBeTruthy())
    await waitFor(() => expect(screen.getByText('Chike')).toBeTruthy())
    await waitFor(() => expect(screen.getByText('Binta')).toBeTruthy())

    const body = document.body.textContent ?? ''
    // Server order: Ama (0), Chike (1), Binta (2) — not arrival order.
    expect(body.indexOf('Ama')).toBeLessThan(body.indexOf('Chike'))
    expect(body.indexOf('Chike')).toBeLessThan(body.indexOf('Binta'))
  })

  it('does not replay an award on duplicate delivery', async () => {
    renderCeremony()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()

    socket.server.emit('ceremony:star', starEvent('most_words', 'Ama', 0, 1))
    await waitFor(() => expect(screen.getAllByText('Ama')).toHaveLength(1))

    // Redelivery — a reconnect, or a retried run.
    socket.server.emit('ceremony:star', starEvent('most_words', 'Ama', 0, 1))
    socket.server.emit('ceremony:star', starEvent('most_words', 'Ama', 0, 1))

    // Still announced exactly once. Keying by star kind is what guarantees this.
    await waitFor(() => expect(screen.getAllByText('Ama')).toHaveLength(1))
  })

  it('does not count the out-of-sequence teacher-star announcement as run progress', async () => {
    renderCeremony()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()

    // The teacher assigns the star; the server announces it immediately with a
    // null seq. That is an acknowledgement, not a step in the run — so it must
    // not make the ceremony look finished.
    socket.server.emit('ceremony:star', starEvent('teacher', 'Ama', null, null))
    await waitFor(() => expect(screen.getByText('Ama')).toBeTruthy())

    expect(screen.queryByText(/Return to session/i)).toBeNull()
  })

  it('ends only on ceremony:end, not when the stars stop arriving', async () => {
    renderCeremony()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()

    socket.server.emit('ceremony:star', starEvent('most_words', 'Ama', 0, 2))
    socket.server.emit('ceremony:star', starEvent('best_spelling', 'Chike', 1, 2))
    await waitFor(() => expect(screen.getByText('Chike')).toBeTruthy())

    // Every star the server said the run contains has been shown — and the
    // ceremony is still not over, because the server has not said so. The old
    // implementation ended here, on a local count.
    expect(screen.queryByText(/Return to session/i)).toBeNull()

    socket.server.emit('ceremony:end', {
      session_id: 'sess-1',
      total_tokens: 4,
      discovery_count: 2,
      stars_total: 2
    })
    await waitFor(() => expect(screen.getByText(/Return to session/i)).toBeTruthy())
  })

  it('transitions consistently for two clients on the same ceremony:end', async () => {
    renderCeremony()
    const first = await waitFor(() => socketRegistry.latest())
    first.server.connect()
    renderCeremony()
    const second = await waitFor(() => {
      const s = socketRegistry.created[1]
      if (!s) throw new Error('second socket not created yet')
      return s
    })
    second.server.connect()

    const run = starEvent('most_words', 'Ama', 0, 1)
    const end = { session_id: 'sess-1', total_tokens: 4, discovery_count: 2, stars_total: 1 }
    first.server.emit('ceremony:star', run)
    second.server.emit('ceremony:star', run)
    first.server.emit('ceremony:end', end)
    second.server.emit('ceremony:end', end)

    // Both screens end together, on the same event.
    await waitFor(() => expect(screen.getAllByText(/Return to session/i)).toHaveLength(2))
  })

  it('does not offer the exit while a star from the run is still missing', async () => {
    renderCeremony()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()

    // The server says three, this client received two — a dropped delivery.
    socket.server.emit('ceremony:star', starEvent('most_words', 'Ama', 0, 3))
    socket.server.emit('ceremony:star', starEvent('best_spelling', 'Chike', 1, 3))
    socket.server.emit('ceremony:end', {
      session_id: 'sess-1',
      total_tokens: 4,
      discovery_count: 2,
      stars_total: 3
    })

    await waitFor(() => expect(screen.getByText('Chike')).toBeTruthy())
    // An incomplete reveal must not present itself as the whole ceremony.
    expect(screen.queryByText(/Return to session/i)).toBeNull()
  })

  it('reconstructs a ceremony that finished before this client arrived', async () => {
    // A late joiner: the events are gone, so REST is the only source.
    h.awards.stars = [star('most_words', 'Ama'), star('discovery', 'Binta', 100)]
    renderCeremony({ alreadyComplete: true })

    // Both awaited: the reveal is asynchronous by design, so a bare assertion
    // right after the first name can land between reveal ticks. (It did, and
    // this test flaked on roughly every other run until it was awaited.)
    await waitFor(() => expect(screen.getByText('Ama')).toBeTruthy())
    await waitFor(() => expect(screen.getByText('Binta')).toBeTruthy())
    // Shown whole, and immediately exitable — there is no live moment to pace.
    await waitFor(() => expect(screen.getByText(/Return to session/i)).toBeTruthy())
  })

  /**
   * A LATE TEACHER-STAR ANNOUNCEMENT MUST NOT UNDO A NUMBERED STAR.
   *
   * The teacher-star announcement (`seq: null`) and the run's numbered
   * re-emission of that same star are two events for one slot. The run normally
   * arrives second, so a plain last-write-wins merge happened to land on the
   * numbered one — but nothing guarantees the order. A reconnect replay could put
   * the null last, and with last-write-wins that dropped the star out of the
   * numbered count for good, so `starsDone` never reached the server's
   * `stars_total` and the exit never appeared: a finished ceremony that insists
   * it is unfinished, with no way forward.
   */
  it('does not let a late null-seq announcement undo a numbered star', async () => {
    renderCeremony()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()

    // The full numbered run arrives first.
    socket.server.emit('ceremony:star', starEvent('most_words', 'Ama', 0, 2))
    socket.server.emit('ceremony:star', starEvent('teachers_star', 'Binta', 1, 2))
    socket.server.emit('ceremony:end', { session_id: 'sess-1', stars_total: 2 })
    await waitFor(() => expect(screen.getByText(/Return to session/i)).toBeTruthy())

    // Then the out-of-sequence acknowledgement for a star already numbered.
    socket.server.emit('ceremony:star', starEvent('teachers_star', 'Binta', null, null))

    // Still complete. Under last-write-wins the numbered entry was replaced by
    // the null one, numberedRevealed fell to 1 of 2, and this exit vanished.
    await settle()
    expect(screen.getByText(/Return to session/i)).toBeTruthy()
    expect(screen.getByText('Binta')).toBeTruthy()
  })

  it('survives unknown and malformed ceremony traffic', async () => {
    renderCeremony()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()
    socket.server.emit('ceremony:star', starEvent('most_words', 'Ama', 0, 1))
    await waitFor(() => expect(screen.getByText('Ama')).toBeTruthy())

    socket.server.emit('ceremony:fanfare', { unknown: true })
    socket.server.emit('ceremony:star', null)
    socket.server.emit('ceremony:end', undefined)

    expect(screen.getByText('Ama')).toBeTruthy()
  })
})
