/**
 * Screen — full-height app frame.
 *
 * Provides safe-area insets, sticky header slot, sticky footer slot, and a
 * scrollable middle region. Used by every top-level screen so they all
 * handle notches, on-screen keyboards, and Android nav bars consistently.
 */
import type { ReactNode } from 'react'
import { useTheme } from '@/theme/useTheme'

interface ScreenProps {
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  /** Override page background — e.g. ceremony screens that use a special gradient. */
  background?: string
  /** Padding around the scrollable content (default 16). */
  pad?: number
  /** Center the content vertically when it doesn't fill the viewport (landing etc.). */
  centered?: boolean
}

export function Screen({ header, footer, children, background, pad = 16, centered = false }: ScreenProps) {
  const { tokens } = useTheme()
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: background ?? tokens.bg,
        color: tokens.text,
      }}
    >
      {header && (
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            padding: `calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px 16px`,
            background: tokens.bg,
            borderBottom: `1px solid ${tokens.border}`,
          }}
        >
          {header}
        </header>
      )}
      <main
        style={{
          flex: 1,
          padding: pad,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          justifyContent: centered ? 'center' : 'flex-start',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </main>
      {footer && (
        <footer
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            padding: `12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px) 16px`,
            background: tokens.bg,
            borderTop: `1px solid ${tokens.border}`,
          }}
        >
          {footer}
        </footer>
      )}
    </div>
  )
}
