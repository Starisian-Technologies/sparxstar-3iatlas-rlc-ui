import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QcScreen } from './QcScreen'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { socketRegistry } from '@/test/fakeSocket'
import type { QcToken } from '@/types'

/**
 * SYNCHRONIZED QC, asserted at screen level.
 *
 * These tests exist because the defect they lock out was invisible to every
 * existing test: the engine emitted `qc:token` and nothing listened, so the
 * teacher's Advance moved nobody and each browser walked a local index. A test
 * that mocked the hook would have passed against that code. So these render the
 * real screen, drive the real hook through a fake socket, and assert what a
 * student would actually see.
 */

vi.mock('@/runtime/socket', async () => {
  const { createTrackedSocket } = await import('@/test/fakeSocket')
  return { createSocket: createTrackedSocket }
})

const TOKENS_FOR_MOCK: QcToken[] = ['alpha', 'beta', 'gamma'].map((text, i) => ({
  token_id: `tok-${i + 1}`,
  text,
  translation: '',
  yahura_transcription: null,
  yahura_confidence: null,
  grammar_domain: 'noun_phrase',
  spelling_signal: 'discovery',
  completeness_signal: 'partial',
  vote_orthography: { yes: 0, no: 0 },
  vote_semantics: { yes: 0, no: 0 },
  vote_audio: { yes: 0, no: 0 },
  qc_translations: []
})) as QcToken[]
const TOKENS = TOKENS_FOR_MOCK

/**
 * Mutable test state the API mock reads. Declared with `vi.hoisted` because
 * `vi.mock` factories are hoisted above ordinary declarations — a plain `let`
 * here would be referenced before initialization.
 */
const h = vi.hoisted(() => ({
  serverState: { seq: 0, token: null as unknown, exhausted: false },
  qcAdvance: vi.fn()
}))

vi.mock('@/api/client', () => ({
  getTeacherToken: () => 'teacher-token',
  api: {
    session: {
      qcWords: async () => TOKENS_FOR_MOCK,
      qcState: async () => ({ ...h.serverState }),
      status: async () => ({
        status: 'qc',
        participant_count: 2,
        token_count: 3,
        time_remaining_seconds: 300,
        leaderboard: [],
        class_xp_total: 0
      }),
      qcAdvance: h.qcAdvance,
      assignTeacherStar: vi.fn(),
      awards: async () => ({ stars: [], leaderboard: [], total_tokens: 0, discovery_count: 0 })
    },
    token: { vote: vi.fn(), correct: vi.fn(), submitTranslation: vi.fn() }
  }
}))

/** Only the two props any test varies — spelled out so every prop stays typed. */
interface QcOverrides {
  participant_id?: string
  isTeacher?: boolean
}

function renderQc(props: QcOverrides = {}) {
  return render(
    <ThemeProvider>
      <QcScreen
        session_id="sess-1"
        participant_id={props.participant_id ?? 'part-1'}
        participant_token="ptok"
        mode="rwc"
        isTeacher={props.isTeacher ?? false}
        onGoCeremony={() => {}}
      />
    </ThemeProvider>
  )
}

/** The payload the engine broadcasts for a QC advance. */
function qcTokenEvent(seq: number, token: QcToken) {
  return {
    seq,
    token_id: token.token_id,
    text: token.text,
    yahura_transcription: null,
    yahura_confidence: null,
    grammar_domain: token.grammar_domain,
    vote_orthography: { yes: 0, no: 0 },
    vote_semantics: { yes: 0, no: 0 },
    vote_audio: { yes: 0, no: 0 }
  }
}

const qcAdvance = h.qcAdvance

beforeEach(() => {
  socketRegistry.reset()
  h.serverState = { seq: 0, token: null, exhausted: false }
  qcAdvance.mockReset()
  qcAdvance.mockResolvedValue({ success: true, token_id: 'tok-1' })
})

describe('QC follows the server, never itself', () => {
  it('waits for the teacher instead of showing the first token', async () => {
    renderQc()
    // The server has not advanced, so there is no current token. The old
    // implementation showed TOKENS[0] here, which is how thirty students each
    // started on their own word.
    await waitFor(() => expect(screen.getByText(/Waiting for your teacher/i)).toBeTruthy())
    expect(screen.queryByText('alpha')).toBeNull()
  })

  it('shows the token the server advanced to', async () => {
    renderQc()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()

    socket.server.emit('qc:token', qcTokenEvent(1, TOKENS[0]!))

    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy())
  })

  it('moves every client to the same token — two screens, one position', async () => {
    // Two independent renders standing in for two students in the room.
    renderQc()
    const first = await waitFor(() => socketRegistry.latest())
    first.server.connect()
    renderQc({ participant_id: 'part-2' })
    const second = await waitFor(() => {
      const s = socketRegistry.created[1]
      if (!s) throw new Error('second socket not created yet')
      return s
    })
    second.server.connect()

    // One broadcast, delivered to both.
    first.server.emit('qc:token', qcTokenEvent(1, TOKENS[1]!))
    second.server.emit('qc:token', qcTokenEvent(1, TOKENS[1]!))

    await waitFor(() => expect(screen.getAllByText('beta')).toHaveLength(2))
    // And neither drifted onto a different word.
    expect(screen.queryByText('alpha')).toBeNull()
    expect(screen.queryByText('gamma')).toBeNull()
  })

  it('ignores a duplicate event for the position it already holds', async () => {
    renderQc()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()

    socket.server.emit('qc:token', qcTokenEvent(2, TOKENS[1]!))
    await waitFor(() => expect(screen.getByText('beta')).toBeTruthy())

    // Redelivery of the same sequence — normal on reconnect.
    socket.server.emit('qc:token', qcTokenEvent(2, TOKENS[1]!))
    await waitFor(() => expect(screen.getAllByText('beta')).toHaveLength(1))
  })

  it('ignores a stale event and does not move backward', async () => {
    renderQc()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()

    socket.server.emit('qc:token', qcTokenEvent(3, TOKENS[2]!))
    await waitFor(() => expect(screen.getByText('gamma')).toBeTruthy())

    // A late delivery of an earlier position. The class has moved on; this
    // client must not rewind to a word the room has finished discussing.
    socket.server.emit('qc:token', qcTokenEvent(1, TOKENS[0]!))
    await waitFor(() => expect(screen.getByText('gamma')).toBeTruthy())
    expect(screen.queryByText('alpha')).toBeNull()
  })

  it('applies out-of-order delivery by sequence, not arrival', async () => {
    renderQc()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()

    // Sequence 3 arrives before sequence 2 — a reordered delivery.
    socket.server.emit('qc:token', qcTokenEvent(3, TOKENS[2]!))
    socket.server.emit('qc:token', qcTokenEvent(2, TOKENS[1]!))

    await waitFor(() => expect(screen.getByText('gamma')).toBeTruthy())
    expect(screen.queryByText('beta')).toBeNull()
  })

  it('hydrates a reconnecting client to the current position', async () => {
    // The client arrives after the class has already reached the third token.
    h.serverState = { seq: 3, token: TOKENS[2]!, exhausted: false }
    renderQc()

    // No events at all — this is pure hydration through REST.
    await waitFor(() => expect(screen.getByText('gamma')).toBeTruthy())
    expect(screen.queryByText('alpha')).toBeNull()
  })

  it('re-hydrates on reconnect, picking up an advance it missed', async () => {
    renderQc()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()
    socket.server.emit('qc:token', qcTokenEvent(1, TOKENS[0]!))
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy())

    // While disconnected, the teacher advances twice.
    socket.server.disconnect()
    h.serverState = { seq: 3, token: TOKENS[2]!, exhausted: false }
    socket.server.connect()

    await waitFor(() => expect(screen.getByText('gamma')).toBeTruthy())
  })

  it('does not let stale hydration drag a client back', async () => {
    renderQc()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()

    // A live event puts the client at sequence 5...
    socket.server.emit('qc:token', qcTokenEvent(5, TOKENS[2]!))
    await waitFor(() => expect(screen.getByText('gamma')).toBeTruthy())

    // ...and a slow hydration response describing sequence 2 arrives afterward.
    // The newer position must win, or a slow network would reintroduce drift.
    h.serverState = { seq: 2, token: TOKENS[0]!, exhausted: false }
    socket.server.connect()
    await waitFor(() => expect(screen.getByText('gamma')).toBeTruthy())
    expect(screen.queryByText('alpha')).toBeNull()
  })

  it('gives a student no way to advance the class', async () => {
    renderQc({ isTeacher: false })
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()
    socket.server.emit('qc:token', qcTokenEvent(1, TOKENS[0]!))
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy())

    // No advance affordance is rendered for a student...
    expect(screen.queryByText(/Next word/i)).toBeNull()
    // ...and nothing the student can do calls the advance endpoint.
    expect(qcAdvance).not.toHaveBeenCalled()
  })

  it('makes the teacher advance a server call, not a local move', async () => {
    renderQc({ isTeacher: true })
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()
    socket.server.emit('qc:token', qcTokenEvent(1, TOKENS[0]!))
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy())

    const button = await waitFor(() => screen.getByText(/Next word/i))
    button.click()

    // It asks the server. Critically, it does NOT move this screen by itself —
    // the new position arrives as a broadcast, the same way a student gets it.
    await waitFor(() => expect(qcAdvance).toHaveBeenCalledWith('sess-1'))
    expect(screen.getByText('alpha')).toBeTruthy()

    socket.server.emit('qc:token', qcTokenEvent(2, TOKENS[1]!))
    await waitFor(() => expect(screen.getByText('beta')).toBeTruthy())
  })

  it('tells the class when the review is finished', async () => {
    h.serverState = { seq: 3, token: null, exhausted: true }
    renderQc()
    await waitFor(() => expect(screen.getByText(/Review finished/i)).toBeTruthy())
  })

  it('survives an unknown server event', async () => {
    renderQc()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()
    socket.server.emit('qc:token', qcTokenEvent(1, TOKENS[0]!))
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy())

    // A newer server emitting something this build has never heard of — normal
    // during a rollout, and it must not take the screen down.
    socket.server.emit('qc:telepathy', { nonsense: true })
    socket.server.emit('some:future-event')

    expect(screen.getByText('alpha')).toBeTruthy()
  })

  it('survives a malformed payload on a known event', async () => {
    renderQc()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()
    socket.server.emit('qc:token', qcTokenEvent(1, TOKENS[0]!))
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy())

    // A field the server renamed, or a null where an object was expected.
    socket.server.emit('qc:vote', { token_id: 'tok-1', dimension: 'orthography' })
    socket.server.emit('qc:token', null)

    expect(screen.getByText('alpha')).toBeTruthy()
  })

  it('never renders a submitter identity', async () => {
    renderQc()
    const socket = await waitFor(() => socketRegistry.latest())
    socket.server.connect()
    socket.server.emit('qc:token', qcTokenEvent(1, TOKENS[0]!))
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy())

    // Vote integrity depends on this: the anonymized payload carries no
    // submitter, and the screen must not invent one from anywhere else.
    const body = document.body.textContent ?? ''
    expect(body).not.toMatch(/part-1/)
    expect(body).not.toMatch(/submitted by/i)
  })
})
