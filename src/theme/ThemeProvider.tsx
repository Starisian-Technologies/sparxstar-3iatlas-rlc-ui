/**
 * ThemeProvider — owns the current theme (dark/light) and an `auto` policy
 * that follows the time of day (06:00–18:00 light; 18:00–06:00 dark).
 *
 * Persists user override in localStorage under `RLC_THEME_PREF`:
 *   - `"auto"` — follow local time of day
 *   - `"dark"` / `"light"` — explicit override
 *
 * Emits CSS custom properties on <html data-theme=…> so plain inline styles
 * can reference them via `var(--bg)`, etc. Components that need the raw token
 * value (canvas, SVG, conditional logic) can call `useTheme()` to get the
 * resolved palette as a JS object.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  TOKEN_KEYS,
  cssVarName,
  themes,
  type ThemeName,
} from './tokens'
import { ThemeContext, type ThemeContextValue, type ThemePreference } from './ThemeContext'

const STORAGE_KEY = 'RLC_THEME_PREF'

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'auto'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'dark' || raw === 'light' || raw === 'auto') return raw
  } catch {
    /* localStorage may be unavailable in private mode / SSR */
  }
  return 'auto'
}

function resolveAutoTheme(now: Date = new Date()): ThemeName {
  const h = now.getHours()
  return h >= 6 && h < 18 ? 'light' : 'dark'
}

function resolveTheme(pref: ThemePreference): ThemeName {
  return pref === 'auto' ? resolveAutoTheme() : pref
}

function applyThemeToDocument(name: ThemeName): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = name
  const palette = themes[name]
  for (const key of TOKEN_KEYS) {
    root.style.setProperty(cssVarName(key), palette[key])
  }
  // PWA meta theme-color so the address bar matches the theme.
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = palette.bg
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference())
  const [resolved, setResolved] = useState<ThemeName>(() => resolveTheme(readStoredPreference()))

  // Apply theme on every change, and re-check auto on a 5-minute interval so
  // sessions that span dusk/dawn flip without a refresh.
  useEffect(() => {
    const next = resolveTheme(preference)
    setResolved(next)
    applyThemeToDocument(next)
  }, [preference])

  useEffect(() => {
    if (preference !== 'auto') return
    const interval = window.setInterval(() => {
      const next = resolveAutoTheme()
      setResolved((prev) => {
        if (prev === next) return prev
        applyThemeToDocument(next)
        return next
      })
    }, 5 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore — preference simply won't persist */
    }
  }, [])

  const toggle = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setPreference])

  const value = useMemo<ThemeContextValue>(
    () => ({ resolved, preference, tokens: themes[resolved], setPreference, toggle }),
    [resolved, preference, setPreference, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
