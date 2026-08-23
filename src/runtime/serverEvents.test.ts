import { describe, expect, it, vi } from 'vitest'
import {
  EVENT_DISPOSITION,
  KNOWN_EVENTS,
  bindServerEvents,
  shouldApplyQcSeq,
  type Disposition
} from './serverEvents'
import { createFakeSocket } from '@/test/fakeSocket'
import type { Socket } from 'socket.io-client'

/**
 * THE EVENT INVENTORY, enforced.
 *
 * The original failure was a silence: the engine emitted thirteen events, the
 * client listened for six, and nothing anywhere said which were which. These
 * tests make that impossible to repeat — the inventory must cover every event in
 * the contract, every entry must state a disposition, and any gap must be
 * declared rather than discovered in a classroom.
 */

/** The events the engine can emit, per the shared contract. Kept explicit so a
 *  contract change has to be reflected here deliberately. */
const CONTRACT_EVENTS = [
  'session:joined',
  'session:left',
  'token:submitted',
  'saturation:signal',
  'session:status',
  'qc:token',
  'qc:audio-ready',
  'qc:vote',
  'qc:translation',
  'qc:correction',
  'ceremony:star',
  'ceremony:end',
  'screentime:limit-reached'
] as const

describe('the server event inventory', () => {
  it('covers all thirteen events the engine emits', () => {
    expect(CONTRACT_EVENTS).toHaveLength(13)
    for (const event of CONTRACT_EVENTS) {
      expect(EVENT_DISPOSITION, `"${event}" is not classified in the inventory`).toHaveProperty(event)
    }
  })

  it('classifies nothing the contract does not declare', () => {
    // A stale entry is as misleading as a missing one: it claims coverage of an
    // event that no longer exists.
    for (const event of KNOWN_EVENTS) {
      expect(CONTRACT_EVENTS as readonly string[]).toContain(event)
    }
  })

  it('gives every event a valid disposition and a reason', () => {
    const valid: Disposition[] = ['handled', 'ignored', 'reserved']
    for (const [event, entry] of Object.entries(EVENT_DISPOSITION)) {
      expect(valid, `${event} has an unrecognised disposition`).toContain(entry.disposition)
      // A note is required for every entry, and it is the whole point for the
      // non-handled ones: a gap that cannot be explained should not be silent.
      expect(entry.note.length, `${event} has no explanatory note`).toBeGreaterThan(0)
    }
  })

  it('currently handles every event, with no silent gaps', () => {
    const unhandled = Object.entries(EVENT_DISPOSITION).filter(([, e]) => e.disposition !== 'handled')
    // If this ever fails, the fix is not to delete the assertion — it is to
    // record WHY the event is ignored or reserved, and update this expectation
    // to name it explicitly.
    expect(unhandled.map(([k]) => k)).toEqual([])
  })
})

describe('bindServerEvents', () => {
  it('delivers known events to their handlers', () => {
    const socket = createFakeSocket()
    const onStatus = vi.fn()
    bindServerEvents(socket as unknown as Socket, { 'session:status': onStatus })

    socket.server.emit('session:status', { status: 'qc' })
    expect(onStatus).toHaveBeenCalledWith({ status: 'qc' })
  })

  it('does not crash on an unknown event, and counts it once per name', () => {
    const socket = createFakeSocket()
    const onUnknown = vi.fn()
    const { unknown } = bindServerEvents(socket as unknown as Socket, {}, { onUnknown })

    socket.server.emit('some:future-event', { a: 1 })
    socket.server.emit('some:future-event', { a: 2 })
    socket.server.emit('another:new-thing')

    // Reported once per distinct name — a chatty unknown event must not flood
    // the console — but counted every time, so the volume is still visible.
    expect(onUnknown).toHaveBeenCalledTimes(2)
    expect(unknown()).toEqual([
      { event: 'some:future-event', count: 2 },
      { event: 'another:new-thing', count: 1 }
    ])
  })

  it('does not report socket.io transport events as unknown', () => {
    const socket = createFakeSocket()
    const onUnknown = vi.fn()
    bindServerEvents(socket as unknown as Socket, {}, { onUnknown })

    socket.server.connect()
    socket.server.disconnect()
    socket.server.emit('reconnect_attempt', 1)

    // A normal connection lifecycle is not a protocol violation.
    expect(onUnknown).not.toHaveBeenCalled()
  })

  it('contains a throwing handler instead of letting it escape', () => {
    const socket = createFakeSocket()
    const good = vi.fn()
    bindServerEvents(socket as unknown as Socket, {
      'qc:token': () => {
        throw new Error('malformed payload')
      },
      'session:status': good
    })

    // The throw is swallowed: losing one update is recoverable, an unmounted
    // React tree mid-session is not.
    expect(() => socket.server.emit('qc:token', null)).not.toThrow()
    // And the other handlers still work afterwards.
    socket.server.emit('session:status', {})
    expect(good).toHaveBeenCalled()
  })

  it('unbinds cleanly so a reconnect cannot double-apply events', () => {
    const socket = createFakeSocket()
    const onStatus = vi.fn()
    const { unbind } = bindServerEvents(socket as unknown as Socket, { 'session:status': onStatus })

    expect(socket.server.listenerCount('session:status')).toBe(1)
    unbind()
    expect(socket.server.listenerCount('session:status')).toBe(0)

    socket.server.emit('session:status', {})
    expect(onStatus).not.toHaveBeenCalled()
  })

  it('stops reporting unknown events after unbind', () => {
    const socket = createFakeSocket()
    const onUnknown = vi.fn()
    const { unbind } = bindServerEvents(socket as unknown as Socket, {}, { onUnknown })
    unbind()
    socket.server.emit('mystery:event')
    expect(onUnknown).not.toHaveBeenCalled()
  })
})

describe('shouldApplyQcSeq', () => {
  it('applies only a strictly newer sequence', () => {
    expect(shouldApplyQcSeq(2, 1)).toBe(true)
    // A repeat of the current position is a duplicate delivery.
    expect(shouldApplyQcSeq(1, 1)).toBe(false)
    // A lower one is a late delivery of a position the class has left.
    expect(shouldApplyQcSeq(1, 5)).toBe(false)
  })

  it('rejects a non-finite sequence rather than treating it as newer', () => {
    // A malformed payload must not be able to jump a client anywhere.
    expect(shouldApplyQcSeq(Number.NaN, 1)).toBe(false)
    expect(shouldApplyQcSeq(Number.POSITIVE_INFINITY, 1)).toBe(false)
    expect(shouldApplyQcSeq(undefined as unknown as number, 1)).toBe(false)
  })

  it('accepts the first advance from a fresh client', () => {
    expect(shouldApplyQcSeq(1, 0)).toBe(true)
  })
})
