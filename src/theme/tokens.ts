/**
 * Theme tokens — dark + light palettes for SPARXSTAR 3iAtlas RLC.
 *
 * Design intent (per product direction, May 2026):
 *   - Mobile first, Africa first, 2014-era devices.
 *   - Warm near-black (#160001), not pure black, with neon accents.
 *   - Light mode for daytime + low-power.
 *   - Both themes must look excellent; dark is the default vibe.
 *
 * These tokens are the source of truth. They are emitted as CSS custom
 * properties on <html data-theme="…"> by ThemeProvider, AND exported as a
 * JS object for components that need raw values (canvas, SVG, charts).
 */

export type ThemeName = 'dark' | 'light'

export interface ThemeTokens {
  // Surfaces
  bg: string             // page background
  bgElevated: string     // slight elevation, app-frame chrome
  card: string           // card surface
  cardElevated: string   // pressed/hover card
  border: string         // subtle dividers, card borders

  // Text
  text: string           // primary text on bg / card
  textMuted: string      // secondary / metadata text
  textInverse: string    // text on primary-coloured surfaces

  // Brand / accents
  primary: string        // primary action — bright neon pink/magenta
  primarySoft: string    // primary at low-alpha (tints, hovers)
  primaryDeep: string    // primary deepened (text on primary buttons in light mode)
  secondary: string      // secondary accent — purple/blue
  gold: string           // gold star / XP highlight

  // Award / star colors (mockup palette)
  starCrown: string      // crown star
  starSilver: string     // silver wave
  starBronze: string     // bronze flame
  starDiscovery: string  // rare-word discovery
  starElder: string      // elder knowledge (warm amber)
  starCommunity: string  // community voice (cyan)
  starGolden: string     // golden voice
  starLightning: string  // lightning linguist
  starPerfect: string    // perfect round
  starHelping: string    // helping hand

  // Status
  success: string
  warning: string
  danger: string

  // Shadows / glows
  glow: string           // primary glow (drop-shadow under cards in dark mode)
}

export const darkTokens: ThemeTokens = {
  bg: '#160001',
  bgElevated: '#1F0608',
  card: '#26090C',
  cardElevated: '#310C10',
  border: 'rgba(255, 200, 210, 0.10)',

  text: '#FFF6F4',
  textMuted: '#B8A3A6',
  textInverse: '#160001',

  primary: '#FF2D78',
  primarySoft: 'rgba(255, 45, 120, 0.18)',
  primaryDeep: '#FF7AA8',
  secondary: '#A855F7',
  gold: '#F5C842',

  starCrown: '#FFB000',
  starSilver: '#A855F7',
  starBronze: '#FF6B35',
  starDiscovery: '#3B82F6',
  starElder: '#F59E0B',
  starCommunity: '#22D3EE',
  starGolden: '#FACC15',
  starLightning: '#A78BFA',
  starPerfect: '#10B981',
  starHelping: '#EC4899',

  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',

  glow: 'rgba(255, 45, 120, 0.45)',
}

export const lightTokens: ThemeTokens = {
  bg: '#FFF8F4',
  bgElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#FFF1ED',
  border: 'rgba(22, 0, 1, 0.10)',

  text: '#160001',
  textMuted: '#6B5256',
  textInverse: '#FFF6F4',

  primary: '#D6005C',
  primarySoft: 'rgba(214, 0, 92, 0.10)',
  primaryDeep: '#8A0039',
  secondary: '#7C3AED',
  gold: '#B8860B',

  starCrown: '#B8860B',
  starSilver: '#7C3AED',
  starBronze: '#D2691E',
  starDiscovery: '#1D4ED8',
  starElder: '#B45309',
  starCommunity: '#0E7490',
  starGolden: '#A16207',
  starLightning: '#6D28D9',
  starPerfect: '#047857',
  starHelping: '#BE185D',

  success: '#15803d',
  warning: '#b45309',
  danger: '#b91c1c',

  glow: 'rgba(214, 0, 92, 0.18)',
}

export const themes: Record<ThemeName, ThemeTokens> = {
  dark: darkTokens,
  light: lightTokens,
}

/**
 * Kebab-case CSS variable name for a token key.
 * `bgElevated` → `--bg-elevated`
 */
export function cssVarName(key: keyof ThemeTokens): string {
  return `--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`
}

/** All token keys in declaration order. */
export const TOKEN_KEYS: (keyof ThemeTokens)[] = Object.keys(darkTokens) as (keyof ThemeTokens)[]
