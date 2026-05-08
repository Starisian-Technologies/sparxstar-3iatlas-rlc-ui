import { SPECIAL_CHARS } from '@/types'

interface AccessoryBarProps {
  onInsert: (char: string) => void
}

/**
 * Special character bar — shown above the keyboard on mobile.
 * ŋ is the highest-risk character. If students cannot type it easily
 * they type n and nobody learns the difference. This is non-negotiable.
 */
export function AccessoryBar({ onInsert }: AccessoryBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Special characters"
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 12px',
        background: '#f1efe8',
        borderTop: '1px solid #d3d1c7',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {SPECIAL_CHARS.map((char) => (
        <button
          key={char}
          type="button"
          onClick={() => onInsert(char)}
          aria-label={`Insert ${char}`}
          style={{
            minWidth: 44,
            minHeight: 44,
            fontSize: 20,
            fontWeight: 500,
            background: '#ffffff',
            border: '1px solid #b4b2a9',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {char}
        </button>
      ))}
    </div>
  )
}
