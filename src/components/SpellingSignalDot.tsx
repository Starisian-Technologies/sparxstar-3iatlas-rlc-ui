import type { SpellingSignal } from '@/types'

const DOT: Record<SpellingSignal, { char: string; color: string; label: string }> = {
  confirmed: { char: '●', color: '#22c55e', label: 'Confirmed spelling'  },
  variant:   { char: '●', color: '#F59E0B', label: 'Spelling variant'    },
  discovery: { char: '★', color: '#FFD700', label: 'New word — discovery' },
}

export function SpellingSignalDot({ signal }: { signal?: SpellingSignal }) {
  if (!signal) return null
  const indicator = DOT[signal]
  return (
    <span aria-label={indicator.label} title={indicator.label} style={{ fontSize: 10, color: indicator.color }}>
      {indicator.char}
    </span>
  )
}
