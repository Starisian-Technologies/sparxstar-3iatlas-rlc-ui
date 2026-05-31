/**
 * Avatar — circular Adinkra-symbol avatar for a student.
 *
 * Same `seed` (typically the screen name) always renders the same Adinkra +
 * background hue, so a child recognises their own avatar across sessions and
 * across leaderboard rows. The Adinkra name + meaning is surfaced as the
 * accessible label and as a tooltip so the symbol becomes a small,
 * incidental cultural lesson.
 *
 * Pure inline SVG — no asset loads, works fine on 2014-era devices.
 */
import { adinkraBgHue, adinkraFor } from './adinkra'
import { useTheme } from '@/theme/useTheme'

interface AvatarProps {
  /** Screen name (or any stable string) used to pick the Adinkra. */
  seed: string
  /** Edge length in px. Defaults to 48. */
  size?: number
  /** Hide the meaning from a11y label (e.g. when it is shown next to the avatar). */
  silent?: boolean
  /** Glow border (for podium / featured spots). */
  highlight?: boolean
}

export function Avatar({ seed, size = 48, silent = false, highlight = false }: AvatarProps) {
  const symbol = adinkraFor(seed)
  const hue = adinkraBgHue(seed)
  const { resolved, tokens } = useTheme()

  const bgSat = resolved === 'dark' ? '55%' : '70%'
  const bgLight = resolved === 'dark' ? '22%' : '88%'
  const accentSat = resolved === 'dark' ? '90%' : '65%'
  const accentLight = resolved === 'dark' ? '70%' : '38%'

  const bg = `hsl(${hue} ${bgSat} ${bgLight})`
  const fg = `hsl(${hue} ${accentSat} ${accentLight})`

  const label = silent ? '' : `${symbol.name} — ${symbol.meaning}`

  return (
    <div
      role="img"
      aria-label={silent ? undefined : label}
      title={label || undefined}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        boxShadow: highlight ? `0 0 0 3px ${tokens.primary}, 0 0 18px ${tokens.glow}` : undefined,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size * 0.7}
        height={size * 0.7}
        fill="none"
        stroke={fg}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {symbol.paths.map((d, i) => (
          <path key={`s-${i}`} d={d} />
        ))}
        {symbol.fills?.map((d, i) => (
          <path key={`f-${i}`} d={d} fill={fg} stroke="none" />
        ))}
      </svg>
    </div>
  )
}
