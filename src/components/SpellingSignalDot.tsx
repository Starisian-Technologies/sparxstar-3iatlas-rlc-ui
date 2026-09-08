import { useTranslation } from 'react-i18next'
import type { SpellingSignal } from '@/types'

/**
 * The glyph and colour are presentation and carry no language. The label is the
 * only thing a screen-reader user receives, so it is translated: an English
 * aria-label on a Mandinka device tells a blind learner nothing.
 */
const DOT: Record<SpellingSignal, { char: string; color: string; labelKey: string; labelEn: string }> = {
  confirmed: { char: '●', color: '#22c55e', labelKey: 'spelling.confirmed', labelEn: 'Confirmed spelling'   },
  variant:   { char: '●', color: '#F59E0B', labelKey: 'spelling.variant',   labelEn: 'Spelling variant'     },
  discovery: { char: '★', color: '#FFD700', labelKey: 'spelling.discovery', labelEn: 'New word — discovery' },
}

export function SpellingSignalDot({ signal }: { signal?: SpellingSignal }) {
  const { t } = useTranslation()
  if (!signal) return null
  const indicator = DOT[signal]
  const label = t(indicator.labelKey, { defaultValue: indicator.labelEn })
  return (
    <span aria-label={label} title={label} style={{ fontSize: 10, color: indicator.color }}>
      {indicator.char}
    </span>
  )
}
