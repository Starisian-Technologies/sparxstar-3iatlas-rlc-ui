import { beforeEach, describe, expect, it } from 'vitest'
import {
  getSequenceStorageKey,
  readPersistedSequence,
  writePersistedSequence,
} from './offlineQueue'

function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => { data.delete(key) },
    setItem: (key: string, value: string) => { data.set(key, value) },
  }
}

describe('offlineQueue sequence persistence', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    })
  })

  it('stores sequence values under a stable session+participant key', () => {
    const key = getSequenceStorageKey('participant-1', 'session-1')
    expect(key).toContain('session-1')
    expect(key).toContain('participant-1')
  })

  it('persists and reloads sequence values from localStorage', () => {
    writePersistedSequence('participant-1', 'session-1', 7)
    expect(readPersistedSequence('participant-1', 'session-1')).toBe(7)
  })

  it('ignores invalid persisted values', () => {
    localStorage.setItem(getSequenceStorageKey('participant-1', 'session-1'), 'not-a-number')
    expect(readPersistedSequence('participant-1', 'session-1')).toBeNull()
  })
})
