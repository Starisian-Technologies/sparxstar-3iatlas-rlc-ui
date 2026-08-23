import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QcScreen } from './QcScreen'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { socketRegistry } from '@/test/fakeSocket'
import type { QcToken } from '@/types'

/**
 * THE THREE VOTE AXES, KEPT SEPARATE.
 *
 * Voting is not moderation bolted onto collection — it is the community
 * validation that produces the platform's linguistic-confidence evidence. So the
 * three axes are collected independently:
 *
 *   pronunciation  "can you hear the word said properly?"  → confidence signal
 *   spelling       "is this spelled correctly?"            → the ONLY axis that
 *                                                            moves workflow state
 *   meaning        "does this make sense?"                 → confidence signal
 *
 * What these tests lock out: the screen used to cast ONE vote per token on ONE
 * dimension chosen by mode — orthography for words, semantics for sentences. So
 * in a sentence session nobody voted on spelling and in a word session nobody
 * voted on meaning, and half the evidence was never collected. The tallies were
 * never merged, so nothing looked wrong; the votes simply did not exist.
 */

vi.mock('@/runtime/socket', async () => {
  const { createTrackedSocket } = await import('@/test/fakeSocket')
  return { createSocket: createTrackedSocket }
})

const h = vi.hoisted(() => ({
  serverState: { seq: 0, token: null as unknown, exhausted: false },
  vote: vi.fn(),
  correct: vi.fn(),
  submitTranslation: vi.fn()
}))

vi.mock('@/api/client', () => ({
  getTeacherToken: () => 'teacher-token',
  api: {
    session: {
      qcWords: async () => [],
      qcState: async () => ({ ...h.serverState }),
      status: async () => ({
        status: 'qc',
        participant_count: 4,
        token_count: 1,
        time_remaining_seconds: 300,
        leaderboard: [],
        class_xp_total: 0
      }),
      qcAdvance: vi.fn(),
      assignTeacherStar: vi.fn(),
      awards: async () => ({ stars: [], leaderboard: [], total_tokens: 0, discovery_count: 0 })
    },
    token: { vote: h.vote, correct: h.correct, submitTranslation: h.submitTranslation }
  }
}))

function token(over: Partial<QcToken> = {}): QcToken {
  return {
    token_id: 'tok-1',
    text: 'kèlèfaa',
    translation: '',
    yahura_transcription: null,
    yahura_confidence: null,
    grammar_domain: 'noun_phrase',
    spelling_signal: 'discovery',
    completeness_signal: 'partial',
    vote_orthography: { yes: 0, no: 0 },
    vote_semantics: { yes: 0, no: 0 },
    vote_audio: { yes: 0, no: 0 },
    qc_translations: [],
    ...over
  } as QcToken
}

/** Tally shape the vote endpoint returns. */
function tallies(over: Partial<Record<'orthography' | 'semantics' | 'audio', { yes: number; no: number }>> = {}) {
  return {
    vote_counts: {
      orthography: { yes: 0, no: 0 },
      semantics: { yes: 0, no: 0 },
      audio: { yes: 0, no: 0 },
      ...over
    }
  }
}

function renderQc(mode: 'rwc' | 'rsc' = 'rwc') {
  return render(
    <ThemeProvider>
      <QcScreen
        session_id="sess-1"
        participant_id="part-1"
        participant_token="ptok"
        mode={mode}
        isTeacher={false}
        onGoCeremony={() => {}}
      />
    </ThemeProvider>
  )
}

/** Dimensions passed to the vote endpoint, in call order. */
function votedDimensions(): string[] {
  return h.vote.mock.calls.map((c) => (c[1] as { dimension: string }).dimension)
}

beforeEach(() => {
  socketRegistry.reset()
  h.vote.mockReset()
  h.correct.mockReset()
  h.submitTranslation.mockReset()
  h.vote.mockResolvedValue(tallies())
  h.serverState = { seq: 1, token: token(), exhausted: false }
})

describe('the three vote axes stay separate', () => {
  it('collects spelling and meaning as two distinct votes in a word session', async () => {
    renderQc('rwc')
    await waitFor(() => expect(screen.getByText(/Is this spelled correctly/i)).toBeTruthy())

    screen.getByLabelText('Vote yes').click()
    await waitFor(() => expect(screen.getByText(/Does this make sense/i)).toBeTruthy())
    screen.getByLabelText('Vote yes').click()

    // Two votes, two different dimensions. The old screen sent exactly one.
    await waitFor(() => expect(votedDimensions()).toEqual(['orthography', 'semantics']))
  })

  it('collects spelling and meaning as two distinct votes in a sentence session too', async () => {
    renderQc('rsc')
    await waitFor(() => expect(screen.getByText(/Is this spelled correctly/i)).toBeTruthy())

    screen.getByLabelText('Vote yes').click()
    await waitFor(() => expect(screen.getByText(/grammar/i)).toBeTruthy())
    screen.getByLabelText('Vote yes').click()

    // The mode no longer decides WHICH axis is collected — both always are.
    await waitFor(() => expect(votedDimensions()).toEqual(['orthography', 'semantics']))
  })

  it('collects pronunciation as its own axis when there is a recording', async () => {
    h.serverState = {
      seq: 1,
      token: token({ yahura_transcription: 'kelefa', vote_audio: { yes: 2, no: 0 } }),
      exhausted: false
    }
    renderQc('rwc')
    await waitFor(() => expect(screen.getByText(/hear the word said properly/i)).toBeTruthy())

    screen.getByLabelText('Pronunciation yes').click()
    await waitFor(() => expect(screen.getByText(/Is this spelled correctly/i)).toBeTruthy())
    screen.getByLabelText('Vote yes').click()
    await waitFor(() => expect(screen.getByText(/Does this make sense/i)).toBeTruthy())
    screen.getByLabelText('Vote yes').click()

    // All three axes, each cast once, each on its own dimension.
    await waitFor(() => expect(votedDimensions()).toEqual(['audio', 'orthography', 'semantics']))
  })

  it('skips the pronunciation vote when nothing was recorded', async () => {
    renderQc('rwc')
    // Straight to spelling: a class must not be asked to rate the pronunciation
    // of a word nobody recorded. Mirrors the server's own skip rule.
    await waitFor(() => expect(screen.getByText(/Is this spelled correctly/i)).toBeTruthy())
    expect(screen.queryByText(/hear the word said properly/i)).toBeNull()
  })

  it('accepts one vote per axis, not one vote per token', async () => {
    renderQc('rwc')
    await waitFor(() => expect(screen.getByText(/Is this spelled correctly/i)).toBeTruthy())

    // Vote spelling, then try again on the same axis: refused (already voted).
    screen.getByLabelText('Vote yes').click()
    await waitFor(() => expect(h.vote).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText(/Does this make sense/i)).toBeTruthy())

    // The meaning axis is a separate right to vote, and it is still available.
    screen.getByLabelText('Vote yes').click()
    await waitFor(() => expect(h.vote).toHaveBeenCalledTimes(2))
  })

  it('branches to correction only from the spelling vote', async () => {
    // Spelling fails; meaning passes.
    h.vote.mockImplementation(async (_id: string, payload: { dimension: string }) =>
      payload.dimension === 'orthography'
        ? tallies({ orthography: { yes: 1, no: 3 } })
        : tallies({ semantics: { yes: 3, no: 0 } })
    )
    renderQc('rwc')
    await waitFor(() => expect(screen.getByText(/Is this spelled correctly/i)).toBeTruthy())
    screen.getByLabelText('Vote no').click()

    // Meaning still comes next — a failed spelling vote does not skip an axis.
    await waitFor(() => expect(screen.getByText(/Does this make sense/i)).toBeTruthy())
    screen.getByLabelText('Vote yes').click()

    // And only now does the correction step appear.
    await waitFor(() => expect(screen.getByText(/Step 4 — Correction/i)).toBeTruthy())
  })

  it('does not branch to correction when a failing MEANING vote is the only failure', async () => {
    h.vote.mockImplementation(async (_id: string, payload: { dimension: string }) =>
      payload.dimension === 'orthography'
        ? tallies({ orthography: { yes: 4, no: 0 } })
        : tallies({ semantics: { yes: 0, no: 4 } })
    )
    renderQc('rwc')
    await waitFor(() => expect(screen.getByText(/Is this spelled correctly/i)).toBeTruthy())
    screen.getByLabelText('Vote yes').click()
    await waitFor(() => expect(screen.getByText(/Does this make sense/i)).toBeTruthy())
    screen.getByLabelText('Vote no').click()

    // Meaning is evidence, not a gate: it never sends a token back for rewriting.
    await waitFor(() => expect(screen.getByText(/Step 5 — Translation/i)).toBeTruthy())
    expect(screen.queryByText(/Step 4 — Correction/i)).toBeNull()
  })

  it('does not treat a tie on spelling as a failure', async () => {
    h.vote.mockImplementation(async (_id: string, payload: { dimension: string }) =>
      payload.dimension === 'orthography'
        ? tallies({ orthography: { yes: 2, no: 2 } })
        : tallies({ semantics: { yes: 2, no: 0 } })
    )
    renderQc('rwc')
    await waitFor(() => expect(screen.getByText(/Is this spelled correctly/i)).toBeTruthy())
    screen.getByLabelText('Vote no').click()
    await waitFor(() => expect(screen.getByText(/Does this make sense/i)).toBeTruthy())
    screen.getByLabelText('Vote yes').click()

    // Strict majority only: `no > yes`. A tie does not trigger correction.
    await waitFor(() => expect(screen.getByText(/Step 5 — Translation/i)).toBeTruthy())
    expect(screen.queryByText(/Step 4 — Correction/i)).toBeNull()
  })

  it('never sends a merged or averaged tally', async () => {
    renderQc('rwc')
    await waitFor(() => expect(screen.getByText(/Is this spelled correctly/i)).toBeTruthy())
    screen.getByLabelText('Vote yes').click()
    await waitFor(() => expect(h.vote).toHaveBeenCalledTimes(1))

    // Each call names exactly one dimension and carries a single yes/no. There is
    // no shape here in which two axes could be combined into one judgement.
    const [, payload] = h.vote.mock.calls[0] as [string, Record<string, unknown>]
    expect(Object.keys(payload).sort()).toEqual(['dimension', 'vote_yes'])
    expect(typeof payload.vote_yes).toBe('boolean')
  })

  it('never shows who submitted the token being voted on', async () => {
    renderQc('rwc')
    await waitFor(() => expect(screen.getByText('kèlèfaa')).toBeTruthy())

    // Anonymity is what stops the vote measuring popularity. The payload carries
    // no submitter, and the screen must not surface one from anywhere else.
    const body = document.body.textContent ?? ''
    expect(body).not.toMatch(/part-1/)
    expect(body).not.toMatch(/submitted by/i)
    expect(body).not.toMatch(/author/i)
  })
})
