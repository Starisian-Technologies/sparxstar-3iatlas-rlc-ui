/**
 * AccessoryBar — special-character bar shown above the keyboard on text-input
 * screens (AGENTS.md / spec §9: mandatory on every screen with a text input).
 *
 * Two groups:
 *   - Single letters with diacritics common in West African orthographies.
 *     `ŋ` is FIRST — non-negotiable per spec, because if students cannot type
 *     it easily they type `n` and the distinction is lost.
 *   - Long-vowel digraphs (aa, ee, ii, oo, uu) inserted as a single string,
 *     bypassing IME so the auto-correct engine never sees a stray vowel
 *     pair to "fix".
 *
 * The parent's `onInsert` is expected to perform a direct value mutation on
 * the focused input (mid-cursor) rather than typing the character through
 * the IME composition layer.
 */
import { SPECIAL_CHARS } from '@/types'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/theme/useTheme'

const LONG_VOWELS = ['aa', 'ee', 'ii', 'oo', 'uu'] as const

interface AccessoryBarProps {
  onInsert: (char: string) => void
}

export function AccessoryBar({ onInsert }: AccessoryBarProps) {
  const { t } = useTranslation()
  const { tokens } = useTheme()

  return (
    <div
      role="toolbar"
      aria-label={t('accessory_bar.label', { defaultValue: 'Special characters' })}
      style={{
        display: 'flex',
        gap: 6,
        padding: '8px 12px calc(env(safe-area-inset-bottom, 0px) + 8px) 12px',
        background: tokens.bgElevated,
        borderTop: `1px solid ${tokens.border}`,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {SPECIAL_CHARS.map((char, index) => (
        <CharButton
          key={char}
          char={char}
          onInsert={onInsert}
          // Highlight ŋ specifically — it's the highest-risk character.
          accent={index === 0}
        />
      ))}

      {/* Visual separator between single chars and digraphs */}
      <div style={{ width: 1, alignSelf: 'stretch', background: tokens.border, margin: '4px 4px' }} aria-hidden="true" />

      {LONG_VOWELS.map((digraph) => (
        <CharButton key={digraph} char={digraph} onInsert={onInsert} compact />
      ))}
    </div>
  )
}

function CharButton({
  char,
  onInsert,
  accent = false,
  compact = false,
}: {
  char: string
  onInsert: (char: string) => void
  accent?: boolean
  compact?: boolean
}) {
  const { tokens } = useTheme()
  return (
    <button
      type="button"
      // Prevent the input from losing focus on tap — the parent will reset
      // focus + cursor in a requestAnimationFrame after the insert.
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
      onClick={() => onInsert(char)}
      aria-label={`Insert ${char}`}
      style={{
        minWidth: compact ? 48 : 44,
        minHeight: 44,
        padding: compact ? '0 10px' : '0 4px',
        fontSize: compact ? 16 : 20,
        fontWeight: accent ? 800 : 600,
        background: accent ? tokens.primarySoft : tokens.card,
        color: accent ? tokens.primary : tokens.text,
        border: `1px solid ${accent ? tokens.primary : tokens.border}`,
        borderRadius: 10,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        WebkitTapHighlightColor: 'transparent',
        fontVariantLigatures: 'none',
      }}
    >
      {char}
    </button>
  )
}
