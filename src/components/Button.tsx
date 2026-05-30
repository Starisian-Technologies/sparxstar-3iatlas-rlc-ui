/**
 * Button — primary/ghost/danger touch-friendly button.
 *
 * Always meets the 44px minimum touch target. `primary` glows in dark mode
 * for that "this is the action" pop without expensive filters that would
 * choke a 2014-era device (single drop-shadow only).
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useTheme } from '@/theme/useTheme'

type Variant = 'primary' | 'ghost' | 'danger' | 'soft'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode
  variant?: Variant
  /** Render full-width (default true on screens, false inline). */
  fullWidth?: boolean
  /** Larger touch target for primary CTAs (56px instead of 48px). */
  large?: boolean
}

export function Button({
  children,
  variant = 'primary',
  fullWidth = true,
  large = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { tokens, resolved } = useTheme()

  const minH = large ? 56 : 48
  const isDark = resolved === 'dark'

  const variantStyles: Record<Variant, React.CSSProperties> = {
    primary: {
      background: tokens.primary,
      color: tokens.textInverse,
      border: 'none',
      boxShadow: isDark ? `0 6px 24px ${tokens.glow}` : 'none',
    },
    ghost: {
      background: 'transparent',
      color: tokens.text,
      border: `1.5px solid ${tokens.border}`,
    },
    soft: {
      background: tokens.primarySoft,
      color: tokens.primary,
      border: `1px solid ${tokens.primarySoft}`,
    },
    danger: {
      background: tokens.danger,
      color: '#ffffff',
      border: 'none',
    },
  }

  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        minHeight: minH,
        width: fullWidth ? '100%' : 'auto',
        padding: '0 20px',
        borderRadius: 14,
        fontSize: large ? 18 : 16,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 80ms ease, opacity 120ms ease',
        WebkitTapHighlightColor: 'transparent',
        ...variantStyles[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
