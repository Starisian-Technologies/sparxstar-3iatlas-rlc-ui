/**
 * XpBar — horizontal progress bar showing XP toward the next level.
 *
 * Visual only. Level and XP values are server-owned (spec §4.3 — UI never
 * computes XP). Pass the current and target XP and let the bar do its job.
 */
import { useTheme } from '@/theme/useTheme'

interface XpBarProps {
  /** Lifetime XP value to display. */
  current: number
  /** XP target for the next level. */
  target: number
  /** Current level number. */
  level?: number
  /** Inline label e.g. "Word Collector" — used as the title above the bar. */
  title?: string
}

export function XpBar({ current, target, level, title }: XpBarProps) {
  const { tokens } = useTheme()
  const pct = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {level !== undefined && (
            <span
              style={{
                background: tokens.primarySoft,
                color: tokens.primary,
                fontWeight: 800,
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 6,
                letterSpacing: 0.3,
              }}
            >
              LVL {level}
            </span>
          )}
          {title && (
            <span style={{ color: tokens.textMuted, fontSize: 13 }}>{title}</span>
          )}
        </div>
        <span style={{ color: tokens.textMuted, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          {current.toLocaleString()} / {target.toLocaleString()} XP
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={target}
        style={{
          height: 8,
          borderRadius: 4,
          background: tokens.border,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${tokens.primary}, ${tokens.secondary})`,
            borderRadius: 4,
            transition: 'width 400ms ease',
          }}
        />
      </div>
    </div>
  )
}
