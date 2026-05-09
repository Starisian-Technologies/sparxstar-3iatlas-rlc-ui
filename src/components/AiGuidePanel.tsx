import { useState } from 'react'

interface AiGuidePanelProps {
  compact?: boolean
}

export function AiGuidePanel({ compact = false }: AiGuidePanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <section style={{ ...panelStyle, ...(compact ? compactStyle : null) }} aria-label="AI Guide panel">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        style={toggleStyle}
        aria-expanded={!collapsed}
      >
        <span style={{ fontWeight: 700 }}>AI Guide</span>
        <span style={{ opacity: 0.8 }}>{collapsed ? 'Expand' : 'Collapse'}</span>
      </button>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Placeholder panel for @sparxstar/sky.
          </div>
          <div style={waveWrapStyle} aria-hidden="true">
            {Array.from({ length: 24 }).map((_, index) => (
              <span
                key={index}
                style={{
                  ...barStyle,
                  animationDelay: `${index * 0.08}s`,
                  height: `${10 + (index % 6) * 4}px`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

const panelStyle: React.CSSProperties = {
  position: 'sticky',
  bottom: 0,
  width: '100%',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'linear-gradient(180deg, rgba(255,45,120,0.12) 0%, rgba(26,20,40,0.96) 100%)',
  padding: 12,
}

const compactStyle: React.CSSProperties = {
  position: 'relative',
}

const toggleStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'rgba(0,0,0,0.25)',
  color: 'var(--text-primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  cursor: 'pointer',
}

const waveWrapStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 999,
  background: 'rgba(13,10,26,0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  overflow: 'hidden',
}

const barStyle: React.CSSProperties = {
  width: 3,
  borderRadius: 999,
  background: 'linear-gradient(180deg, var(--accent-secondary) 0%, var(--accent-primary) 100%)',
  animation: 'spx-wave 1.2s ease-in-out infinite',
}
