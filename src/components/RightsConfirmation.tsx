/**
 * T1 rights confirmation (canonical spec §1.10).
 *
 * > Set at session creation. Teacher confirms each field — suggested presets,
 * > never forced.
 * > … ai_training: Consent to use derived signal for AI model training — never
 * > defaulted true without confirmation.
 * > Rights travel with every token through every downstream system. Never
 * > stripped.
 *
 * THIS COMPONENT HAS NO DEFAULTS, AND THAT IS THE WHOLE POINT. Every field
 * starts unset and the parent cannot create a session until all three have been
 * answered. A pre-selected control is a forced default wearing a friendlier
 * face: the teacher clicks past it, the value rides on every token the class
 * produces, and rights cannot be retightened after collection — so a default
 * chosen for convenience here is permanent for that data.
 *
 * `ai_training` is not special-cased into a different widget. It is answered the
 * same explicit way as the others, which is what "never defaulted true without
 * confirmation" actually requires — a No default would satisfy the letter of
 * that sentence while still being a default.
 */
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/Card'
import { useTheme } from '@/theme/useTheme'
// The domain half — presets, the tri-state, and the completeness rule — lives
// in runtime/rights.ts and is imported from there by every caller, so the "no
// defaults" rule has one home rather than two.
import {
  LICENSE_PRESETS,
  isRightsComplete,
  type RightsDraft,
  type Tri,
} from '@/runtime/rights'

interface RightsConfirmationProps {
  value: RightsDraft
  onChange: (next: RightsDraft) => void
  disabled?: boolean
}

export function RightsConfirmation({ value, onChange, disabled = false }: RightsConfirmationProps) {
  const { t } = useTranslation()
  const { tokens } = useTheme()

  const selectStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 48,
    padding: '0 12px',
    background: tokens.bg,
    color: value.license === null ? tokens.textMuted : tokens.text,
    border: `1.5px solid ${value.license === null ? tokens.warning : tokens.border}`,
    borderRadius: 12,
    fontSize: 16,
  }

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: tokens.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {t('teacher_setup.rights.heading', { defaultValue: 'Data rights' })}
          </div>
          <div style={{ fontSize: 13, color: tokens.textMuted, marginTop: 4, lineHeight: 1.5 }}>
            {t('teacher_setup.rights.explainer', {
              defaultValue:
                'These choices travel with every word your class contributes, to every system that receives it. They cannot be narrowed later, so please answer each one.',
            })}
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>
            {t('teacher_setup.rights.license_label', { defaultValue: 'License for the derived data' })}
          </span>
          <select
            value={value.license ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, license: e.target.value === '' ? null : e.target.value })}
            style={selectStyle}
            aria-label={t('teacher_setup.rights.license_label', { defaultValue: 'License for the derived data' })}
          >
            <option value="">
              {t('teacher_setup.rights.license_unset', { defaultValue: 'Choose a license…' })}
            </option>
            {LICENSE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </label>

        <TriQuestion
          id="ai_training"
          question={t('teacher_setup.rights.ai_training_question', {
            defaultValue: 'May this language data help train AI models?',
          })}
          value={value.ai_training}
          disabled={disabled}
          onChange={(next) => onChange({ ...value, ai_training: next })}
        />

        <TriQuestion
          id="commercial"
          question={t('teacher_setup.rights.commercial_question', {
            defaultValue: 'May this language data be used commercially?',
          })}
          value={value.commercial}
          disabled={disabled}
          onChange={(next) => onChange({ ...value, commercial: next })}
        />

        {!isRightsComplete(value) && (
          <div role="status" style={{ fontSize: 13, color: tokens.warning }}>
            {t('teacher_setup.rights.incomplete', {
              defaultValue: 'Answer all three to start the session.',
            })}
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * A yes/no question with no third "default" position. Rendered as a radiogroup
 * so a screen reader announces it as an unanswered choice rather than as two
 * unrelated buttons.
 */
function TriQuestion({
  id,
  question,
  value,
  onChange,
  disabled,
}: {
  id: string
  question: string
  value: Tri
  onChange: (next: Tri) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const { tokens } = useTheme()
  const options: Array<{ key: Exclude<Tri, 'unset'>; label: string }> = [
    { key: 'yes', label: t('common.yes', { defaultValue: 'Yes' }) },
    { key: 'no', label: t('common.no', { defaultValue: 'No' }) },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span id={`rights-${id}-label`} style={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>
        {question}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`rights-${id}-label`}
        style={{
          display: 'flex',
          gap: 8,
          padding: 4,
          background: tokens.bg,
          border: `1px solid ${value === 'unset' ? tokens.warning : tokens.border}`,
          borderRadius: 12,
        }}
      >
        {options.map((opt) => {
          const selected = value === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(opt.key)}
              style={{
                flex: '1 1 0',
                // 44px minimum touch target.
                minHeight: 44,
                fontSize: 15,
                fontWeight: 700,
                background: selected ? tokens.primary : 'transparent',
                color: selected ? tokens.textInverse : tokens.textMuted,
                border: 'none',
                borderRadius: 8,
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
