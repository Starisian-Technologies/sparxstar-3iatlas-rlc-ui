/**
 * Bare React context for the active theme. Kept in its own module so the
 * provider and consumer hook can both import it without tripping Vite's
 * "components-only" rule for Fast Refresh.
 */
import { createContext } from 'react'
import type { ThemeName, ThemeTokens } from './tokens'

export type ThemePreference = ThemeName | 'auto'

export interface ThemeContextValue {
  resolved: ThemeName
  preference: ThemePreference
  tokens: ThemeTokens
  setPreference(pref: ThemePreference): void
  toggle(): void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
