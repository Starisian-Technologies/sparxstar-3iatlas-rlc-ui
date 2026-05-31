/**
 * Card — neutral surface block used across screens.
 *
 * Lightweight on purpose — single solid background + 1px border + 12-16px
 * radius. No blur filters, no gradients (heavy on cheap GPUs).
 */
import type { CSSProperties, ReactNode } from 'react'
import { useTheme } from '@/theme/useTheme'

interface CardProps {
  children: ReactNode
  /** Pop the card forward (used for focus areas like Round Complete). */
  highlight?: boolean
  /** Override padding (default 16). */
  pad?: number
  style?: CSSProperties
  onClick?: () => void
}

export function Card({ children, highlight = false, pad = 16, style, onClick }: CardProps) {
  const { tokens, resolved } = useTheme()
  const isDark = resolved === 'dark'

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        background: highlight ? tokens.cardElevated : tokens.card,
        border: `1px solid ${highlight ? tokens.primarySoft : tokens.border}`,
        borderRadius: 16,
        padding: pad,
        boxShadow: highlight && isDark ? `0 4px 32px ${tokens.glow}` : undefined,
        cursor: onClick ? 'pointer' : undefined,
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
