/**
 * StarBadge — neon five-point star used for award counts and stat chips.
 *
 * Renders as inline SVG (no asset load). Pure stroke + single fill — cheap
 * to paint on low-end devices.
 */
import { useTheme } from '@/theme/useTheme'
import type { ThemeTokens } from '@/theme/tokens'

export type StarVariant =
  | 'gold'
  | 'crown'
  | 'silver'
  | 'bronze'
  | 'discovery'
  | 'elder'
  | 'community'
  | 'golden'
  | 'lightning'
  | 'perfect'
  | 'helping'

const VARIANT_TOKEN: Record<StarVariant, keyof ThemeTokens> = {
  gold: 'gold',
  crown: 'starCrown',
  silver: 'starSilver',
  bronze: 'starBronze',
  discovery: 'starDiscovery',
  elder: 'starElder',
  community: 'starCommunity',
  golden: 'starGolden',
  lightning: 'starLightning',
  perfect: 'starPerfect',
  helping: 'starHelping',
}

interface StarBadgeProps {
  size?: number
  variant?: StarVariant
  /** Visible numeric count next to the star (e.g. "2", "+140"). */
  count?: string | number
  /** Accessible label for the count + star combo. */
  label?: string
}

export function StarBadge({ size = 16, variant = 'gold', count, label }: StarBadgeProps) {
  const { tokens, resolved } = useTheme()
  const color = tokens[VARIANT_TOKEN[variant]]
  const isDark = resolved === 'dark'

  return (
    <span
      aria-label={label}
      role={label ? 'img' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color: tokens.text,
        fontWeight: 700,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ filter: isDark ? `drop-shadow(0 0 6px ${color}99)` : undefined }}
      >
        <path
          d="M12 2.5l2.97 6.02 6.64.97-4.8 4.68 1.13 6.6L12 17.77l-5.94 3.12 1.13-6.6L2.4 9.49l6.64-.97L12 2.5z"
          fill={color}
        />
      </svg>
      {count !== undefined && <span style={{ fontSize: size * 0.85 }}>{count}</span>}
    </span>
  )
}
