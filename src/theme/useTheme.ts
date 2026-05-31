/**
 * useTheme — read the active palette + preference, and switch themes.
 *
 * Lives in its own file (apart from ThemeProvider) so the provider module
 * stays a "components-only" module for Vite Fast Refresh.
 */
import { useContext } from 'react'
import { ThemeContext, type ThemeContextValue } from './ThemeContext'

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
