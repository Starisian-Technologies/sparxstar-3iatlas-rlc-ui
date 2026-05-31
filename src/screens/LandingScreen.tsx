/**
 * LandingScreen — the first thing a student or teacher sees.
 *
 * Two paths: "Join a session" (student) and "Start a session" (teacher).
 * Designed for the welcoming first impression — warm-dark by default with
 * the tenant mark, theme toggle in the corner, and oversized primary CTA so
 * the join path is obviously the main road.
 */
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { TenantLogo } from '@/components/TenantLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { StarBadge } from '@/components/StarBadge'
import { useTheme } from '@/theme/useTheme'

interface LandingScreenProps {
  onJoin: () => void
  onTeacher: () => void
}

export function LandingScreen({ onJoin, onTeacher }: LandingScreenProps) {
  const { tokens, resolved } = useTheme()

  return (
    <Screen
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <TenantLogo size="medium" />
          <ThemeToggle />
        </div>
      }
      centered
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, maxWidth: 360, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1.05,
              background: `linear-gradient(120deg, ${tokens.primary}, ${tokens.secondary})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: tokens.primary,
            }}
          >
            Rapid Language Collection
          </div>
          <div style={{ fontSize: 16, color: tokens.textMuted }}>
            Collect words. Share your language.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '10px 16px',
            background: tokens.cardElevated,
            border: `1px solid ${tokens.border}`,
            borderRadius: 999,
            fontSize: 13,
            color: tokens.textMuted,
          }}
        >
          <StarBadge variant="discovery" size={14} />
          <span>Earn stars for every new word you teach</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          <Button onClick={onJoin} variant="primary" large>
            Join a session
          </Button>
          <Button onClick={onTeacher} variant="ghost">
            Start a session (teacher)
          </Button>
        </div>

        <div style={{ marginTop: 8, color: tokens.textMuted, fontSize: 12, textAlign: 'center' }}>
          {resolved === 'dark' ? 'Dark · auto by time of day' : 'Light · auto by time of day'}
        </div>
      </div>
    </Screen>
  )
}
