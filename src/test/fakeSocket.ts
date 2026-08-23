/**
 * A fake socket.io client, good enough to drive the real hooks.
 *
 * Why not mock the hooks instead: the defect this whole change fixes was a
 * MISSING LISTENER. A test that mocks the hook asserts the screen renders what
 * the hook returned, which was always true — it would have passed against the
 * broken code. So the tests drive the real hooks through a real-shaped socket and
 * assert on what the user sees.
 *
 * Supports the parts of the socket.io surface the hooks use: `on`, `off`, `emit`,
 * `onAny`, `offAny`, `disconnect`, plus `server.emit(...)` to push an event down
 * and `server.connect()` to fire the connect lifecycle.
 */
export interface FakeSocket {
  on: (event: string, handler: (...args: unknown[]) => void) => FakeSocket
  off: (event: string, handler?: (...args: unknown[]) => void) => FakeSocket
  onAny: (handler: (event: string, ...args: unknown[]) => void) => FakeSocket
  offAny: (handler?: (event: string, ...args: unknown[]) => void) => FakeSocket
  emit: (event: string, ...args: unknown[]) => FakeSocket
  disconnect: () => FakeSocket
  connected: boolean
  /** Test-side control surface. */
  server: {
    /** Push an event to every listener, as the server would. */
    emit: (event: string, ...args: unknown[]) => void
    /** Fire the connect lifecycle event. */
    connect: () => void
    /** Fire disconnect. */
    disconnect: () => void
    /** Events the client emitted upward (e.g. heartbeat). */
    clientEmissions: Array<{ event: string; args: unknown[] }>
    /** How many listeners are attached for an event — catches duplicate binds. */
    listenerCount: (event: string) => number
    disconnectCalls: number
  }
}

export function createFakeSocket(): FakeSocket {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  const anyListeners: Array<(event: string, ...args: unknown[]) => void> = []
  const clientEmissions: Array<{ event: string; args: unknown[] }> = []
  let disconnectCalls = 0

  const socket: FakeSocket = {
    connected: false,
    on(event, handler) {
      const list = listeners.get(event) ?? []
      list.push(handler)
      listeners.set(event, list)
      return socket
    },
    off(event, handler) {
      if (!handler) {
        listeners.delete(event)
        return socket
      }
      const list = (listeners.get(event) ?? []).filter((h) => h !== handler)
      listeners.set(event, list)
      return socket
    },
    onAny(handler) {
      anyListeners.push(handler)
      return socket
    },
    offAny(handler) {
      if (!handler) {
        anyListeners.length = 0
        return socket
      }
      const i = anyListeners.indexOf(handler)
      if (i >= 0) anyListeners.splice(i, 1)
      return socket
    },
    emit(event, ...args) {
      clientEmissions.push({ event, args })
      return socket
    },
    disconnect() {
      disconnectCalls += 1
      socket.connected = false
      return socket
    },
    server: {
      emit(event, ...args) {
        for (const handler of [...(listeners.get(event) ?? [])]) handler(...args)
        for (const any of [...anyListeners]) any(event, ...args)
      },
      connect() {
        socket.connected = true
        socket.server.emit('connect')
      },
      disconnect() {
        socket.connected = false
        socket.server.emit('disconnect', 'transport close')
      },
      clientEmissions,
      listenerCount: (event: string) => (listeners.get(event) ?? []).length,
      get disconnectCalls() {
        return disconnectCalls
      }
    }
  }
  return socket
}

/**
 * Registry of sockets handed out by the mocked `createSocket`.
 *
 * A test mocks `@/runtime/socket` with an async factory that dynamically imports
 * this module, so the mock and the test share one registry instance despite
 * `vi.mock` being hoisted above ordinary imports.
 */
export const socketRegistry: {
  created: FakeSocket[]
  reset: () => void
  latest: () => FakeSocket
} = {
  created: [],
  reset() {
    socketRegistry.created = []
  },
  latest() {
    const s = socketRegistry.created[socketRegistry.created.length - 1]
    if (!s) throw new Error('no socket was created — did the hook receive an auth object?')
    return s
  }
}

/** The `createSocket` replacement: records every socket it hands out. */
export function createTrackedSocket(): FakeSocket {
  const socket = createFakeSocket()
  socketRegistry.created.push(socket)
  return socket
}
