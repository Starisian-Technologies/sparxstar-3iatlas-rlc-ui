import { useState } from 'react'
import { invokeAbility, type AbilityContext, type AbilityName, type AbilityResult } from '@/runtime/abilities'

interface AiGuidePanelProps {
  compact?: boolean
  context?: AbilityContext
}

const ABILITIES: Array<{ name: AbilityName; label: string }> = [
  { name: 'eshu.translate', label: 'Translate' },
  { name: 'eshu.pronunciation', label: 'Pronounce' },
  { name: 'eshu.semanticHint', label: 'Semantic hint' },
]

export function AiGuidePanel({ compact = false, context }: AiGuidePanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [activeAbility, setActiveAbility] = useState<AbilityName | null>(null)
  const [result, setResult] = useState<AbilityResult | null>(null)

  const handleAbility = async (ability: AbilityName) => {
    setActiveAbility(ability)
    try {
      const nextResult = await invokeAbility(ability, context)
      setResult(nextResult)
    } finally {
      setActiveAbility(null)
    }
  }

  return (
    <section style={{ ...panelStyle, ...(compact ? compactStyle : null) }} aria-label="Guide panel">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        style={toggleStyle}
        aria-expanded={!collapsed}
      >
        <span style={{ fontWeight: 700 }}>Guide</span>
        <span style={{ opacity: 0.8 }}>{collapsed ? 'Expand' : 'Collapse'}</span>
      </button>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Invoke runtime abilities through a stable boundary while the service layer is still lightweight.
          </div>
          <div style={abilityListStyle}>
            {ABILITIES.map((ability) => (
              <button
                key={ability.name}
                type="button"
                onClick={() => void handleAbility(ability.name)}
                disabled={activeAbility !== null}
                style={abilityButtonStyle(activeAbility === ability.name)}
              >
                {activeAbility === ability.name ? 'Working…' : ability.label}
              </button>
            ))}
          </div>
          <div style={resultPanelStyle}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-secondary)' }}>
              {result?.title ?? 'Ability boundary'}
            </div>
            <div style={{ fontSize: 13 }}>
              {result?.summary ?? 'Ready to route translation, pronunciation, and semantic hint requests through invokeAbility().'}
            </div>
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

const abilityListStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const abilityButtonStyle = (active: boolean): React.CSSProperties => ({
  minHeight: 38,
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: active ? 'rgba(255,45,120,0.22)' : 'rgba(255,255,255,0.05)',
  color: 'var(--text-primary)',
  padding: '8px 12px',
  cursor: 'pointer',
})

const resultPanelStyle: React.CSSProperties = {
  borderRadius: 10,
  background: 'rgba(13,10,26,0.72)',
  border: '1px solid var(--border)',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}
