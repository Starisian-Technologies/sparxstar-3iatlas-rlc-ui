import '@testing-library/dom'
import '@/i18n'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * Test environment setup.
 *
 * `cleanup` after every test so a screen from one case cannot keep listening to
 * a socket in the next — which would make the idempotency assertions below pass
 * or fail depending on test order.
 */
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/**
 * jsdom has no `matchMedia`, which the theme provider reads. A minimal stub is
 * enough: none of these tests assert on theme.
 */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia
}
