import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionPoll } from '@/hooks/useSessionPoll'
import { TenantLogo } from '@/components/TenantLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/theme/useTheme'
import type { SessionStatus } from '@/types'

interface RscCompleteScreenProps {
  session_id: string
  submittedCount: number
  onCollectionEnded: (status: SessionStatus) => void
}

export function RscCompleteScreen({ session_id, submittedCount, onCollectionEnded }: RscCompleteScreenProps) {
  const { t } = useTranslation()
  const { tokens } = useTheme()
  const hasCollectionEndedRef = useRef(false)
  const [pollingEnabled, setPollingEnabled] = useState(true)
  const { session } = useSessionPoll(session_id, pollingEnabled)

  useEffect(() => {
    const status = session?.status
    if (!hasCollectionEndedRef.current && status && status !== 'open') {
      hasCollectionEndedRef.current = true
      setPollingEnabled(false)
      onCollectionEnded(status)
    }
  }, [onCollectionEnded, session?.status])

  return (
    <div style={{
      minHeight: '100dvh',
      background: tokens.bg,
      color: tokens.text,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        borderBottom: `1px solid ${tokens.border}`,
      }}>
        <TenantLogo size="small" />
        <ThemeToggle />
      </div>

      {/* Main content — centered */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 24,
        textAlign: 'center',
      }}>
        {/* Success icon */}
        <div style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          background: `rgba(34,197,94,0.15)`,
          border: `2px solid ${tokens.success}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg aria-hidden="true" width={48} height={48} viewBox="0 0 48 48" fill="none">
            <path d="M12 24l9 9 15-16" stroke={tokens.success} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: tokens.text, letterSpacing: -0.5 }}>
            {t('rsc_complete.title', { defaultValue: 'All done!' })}
          </div>
          <div style={{
            fontSize: 18,
            color: tokens.primary,
            fontWeight: 700,
          }}>
            {submittedCount} sentence{submittedCount !== 1 ? 's' : ''} submitted
          </div>
          <div style={{ fontSize: 15, color: tokens.textMuted, maxWidth: 280, lineHeight: 1.5 }}>
            {t('rsc_complete.body', { defaultValue: 'You contributed to the class language record. Waiting for everyone else to finish…' })}
          </div>
        </div>

        {/* Waiting pulse card */}
        <div style={{
          background: tokens.card,
          border: `1px solid ${tokens.border}`,
          borderRadius: 16,
          padding: '20px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          width: '100%',
          maxWidth: 320,
        }}>
          <PulsingDot color={tokens.primary} />
          <div style={{ fontSize: 14, color: tokens.textMuted, lineHeight: 1.5 }}>
            {t('rsc_complete.teacher_note', { defaultValue: 'Your teacher will start the review when everyone is ready.' })}
          </div>
        </div>

        {/* Motivational XP note */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: tokens.textMuted,
        }}>
          <span style={{ fontSize: 16 }}>⭐</span>
          <span>{t('rsc_complete.xp_note', { defaultValue: 'XP for each sentence will appear after the review' })}</span>
        </div>
      </div>
    </div>
  )
}

function PulsingDot({ color }: { color: string }) {
  return (
    <div style={{ position: 'relative', width: 20, height: 20 }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: color,
        opacity: 0.3,
        animation: 'spx-sync-pulse 1.4s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute',
        inset: 4,
        borderRadius: '50%',
        background: color,
      }} />
    </div>
  )
}
