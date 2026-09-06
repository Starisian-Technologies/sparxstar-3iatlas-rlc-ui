/**
 * Shown when a teacher reaches the app without an Identity token.
 *
 * The teacher's credential is Identity-issued and supplied by the host page in
 * memory (NODE-ADR-007: Identity authenticates, RLC authorizes). There is no
 * `/auth/login` in the RLC contract, so this screen cannot offer a sign-in form
 * — it can only say what is missing.
 *
 * WHAT IT MUST NOT DO IS NAME A COMPONENT THAT DOES NOT EXIST. The copy this
 * replaces told the teacher to "open this page from the WordPress orchestrator".
 * There is no WordPress orchestrator and none is to be created (owner ruling,
 * 2026-08-23), so that instruction could not be followed by anyone who read it.
 * The wording below points at the school's own portal, which is whatever the
 * deployment actually mounts this app inside, and does not invent a name for it.
 */
import { useTranslation } from 'react-i18next'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { useTheme } from '@/theme/useTheme'

interface TeacherSignedOutProps {
  onBack: () => void
}

export function TeacherSignedOut({ onBack }: TeacherSignedOutProps) {
  const { t } = useTranslation()
  const { tokens } = useTheme()

  return (
    <Screen centered>
      <div style={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: tokens.text, margin: 0 }}>
          {t('teacher_login.signed_out_title', { defaultValue: 'You are not signed in' })}
        </h1>
        <p style={{ color: tokens.textMuted, lineHeight: 1.5, margin: 0, fontSize: 15 }}>
          {t('teacher_login.signed_out_body', {
            defaultValue:
              'Open this page from your school portal so it can sign you in. Your session is never stored on this device.',
          })}
        </p>
        <Button onClick={onBack} variant="ghost">
          {t('teacher_login.back', { defaultValue: '← Back' })}
        </Button>
      </div>
    </Screen>
  )
}
