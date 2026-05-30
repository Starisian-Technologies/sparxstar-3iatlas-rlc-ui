/**
 * ThemeToggle — small sun/moon button that flips between dark and light
 * themes. Drops the user out of `auto` mode on tap.
 */
import { useTheme } from '@/theme/useTheme'

export function ThemeToggle({ size = 36 }: { size?: number }) {
  const { resolved, toggle, tokens } = useTheme()
  const isDark = resolved === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        width: size,
        height: size,
        minHeight: size,
        borderRadius: '50%',
        border: `1px solid ${tokens.border}`,
        background: tokens.cardElevated,
        color: tokens.text,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isDark ? (
          // Moon — current theme is dark, tapping switches to light
          <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
        ) : (
          // Sun — current theme is light, tapping switches to dark
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" stroke="none" />
        )}
      </svg>
    </button>
  )
}
