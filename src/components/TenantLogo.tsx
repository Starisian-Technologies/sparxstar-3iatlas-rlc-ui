/**
 * TenantLogo — renders the brand mark for the current deployment.
 *
 * If the host page injects `window.RLC_TENANT_LOGO` (a URL), that logo is
 * shown. Otherwise we render the canonical "3iAtlas RLC" word-mark in text.
 * This keeps the codebase product-neutral while letting an integrator
 * (e.g. AIWA, a school district) drop in their own brand without a code
 * change.
 */
import { useTheme } from '@/theme/useTheme'

interface TenantLogoProps {
  /** Render size — controls height of the logo / text. */
  size?: 'small' | 'medium' | 'large'
}

declare global {
  interface Window {
    RLC_TENANT_LOGO?: string
    RLC_TENANT_NAME?: string
  }
}

export function TenantLogo({ size = 'medium' }: TenantLogoProps) {
  const { tokens } = useTheme()
  const logoUrl = typeof window !== 'undefined' ? window.RLC_TENANT_LOGO : undefined
  const tenantName = (typeof window !== 'undefined' && window.RLC_TENANT_NAME) || '3iAtlas RLC'

  const fontSize = size === 'large' ? 28 : size === 'medium' ? 18 : 14
  const imgHeight = size === 'large' ? 40 : size === 'medium' ? 28 : 20

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={tenantName}
        style={{ height: imgHeight, width: 'auto', display: 'block' }}
      />
    )
  }

  return (
    <div
      aria-label={tenantName}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        fontWeight: 800,
        fontSize,
        letterSpacing: -0.5,
        color: tokens.text,
      }}
    >
      <span style={{ color: tokens.primary }}>3i</span>
      <span>Atlas</span>
      <span style={{ color: tokens.textMuted, fontWeight: 600, fontSize: fontSize * 0.7, marginLeft: 4 }}>RLC</span>
    </div>
  )
}
