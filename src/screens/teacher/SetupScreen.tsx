import { useState } from 'react'
import { api } from '@/api/client'
import type { CollectionMode, CollectionDepth, CreateSessionResponse } from '@/types'

interface SetupScreenProps {
  onCreated: (result: CreateSessionResponse & { mode: CollectionMode; collection_depth: CollectionDepth; language: string }) => void
}

const LANGUAGES = [
  { code: 'mandinka', label: 'Mandinka' },
  { code: 'wolof',    label: 'Wolof' },
  { code: 'fula',     label: 'Fula / Pulaar' },
  { code: 'jola',     label: 'Jola' },
  { code: 'serer',    label: 'Serer' },
]

const DURATIONS = [5, 10, 15, 20]

/**
 * T1 — Teacher session setup screen.
 * Select mode, language, semantic domain, duration, collection depth.
 */
export function SetupScreen({ onCreated }: SetupScreenProps) {
  const [mode, setMode] = useState<CollectionMode>('rwc')
  const [language, setLanguage] = useState('mandinka')
  const [domain, setDomain] = useState('6.2')
  const [duration, setDuration] = useState(15)
  const [depth, setDepth] = useState<CollectionDepth>('translation_only')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.session.create({
        mode,
        language,
        semantic_domain_id: domain,
        duration_minutes: duration,
        collection_depth: depth,
      })
      onCreated({ ...result, mode, collection_depth: depth, language })
    } catch {
      setError('Could not create session. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#f4f4f4',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1B3A6B' }}>New Session</div>

      {/* Mode */}
      <Field label="Mode">
        <SegmentedControl
          options={[
            { value: 'rwc', label: 'Word collection' },
            { value: 'rsc', label: 'Sentence collection' },
          ]}
          value={mode}
          onChange={(v) => setMode(v as CollectionMode)}
        />
      </Field>

      {/* Language */}
      <Field label="Language">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={selectStyle}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </Field>

      {/* Semantic domain */}
      <Field label="Semantic domain">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="e.g. 6.2 (Agriculture)"
          style={inputStyle}
        />
      </Field>

      {/* Duration */}
      <Field label="Duration">
        <SegmentedControl
          options={DURATIONS.map((d) => ({ value: String(d), label: `${d} min` }))}
          value={String(duration)}
          onChange={(v) => setDuration(Number(v))}
        />
      </Field>

      {/* Collection depth */}
      <Field label="Collection depth">
        <SegmentedControl
          options={[
            { value: 'translation_only', label: 'Translation' },
            { value: 'basic', label: 'Basic' },
          ]}
          value={depth}
          onChange={(v) => setDepth(v as CollectionDepth)}
        />
        <div style={{ fontSize: 12, color: '#a855f7', marginTop: 6 }}>
          Audio recording (full depth) is not enabled in this sprint.
        </div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
          {depth === 'translation_only' && 'Word + translation, no recording'}
          {depth === 'basic' && 'Word only'}
        </div>
      </Field>

      {error && (
        <div role="alert" style={{
          background: '#ffeded', border: '1px solid #f09595',
          borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#a32d2d',
        }}>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={loading}
        style={{
          minHeight: 52, fontSize: 18, fontWeight: 700,
          background: loading ? '#b4b2a9' : '#1B3A6B',
          color: '#ffffff', border: 'none', borderRadius: 10,
          cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8,
        }}
      >
        {loading ? 'Creating…' : 'Create session'}
      </button>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{label}</div>
      {children}
    </div>
  )
}

function SegmentedControl({
  options, value, onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            minHeight: 40, padding: '0 14px', fontSize: 14, fontWeight: 600,
            background: value === opt.value ? '#1B3A6B' : '#ffffff',
            color: value === opt.value ? '#ffffff' : '#1a1a1a',
            border: `2px solid ${value === opt.value ? '#1B3A6B' : '#b4b2a9'}`,
            borderRadius: 8, cursor: 'pointer', flex: '1 1 auto',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%', fontSize: 16, padding: '10px 14px',
  border: '2px solid #b4b2a9', borderRadius: 8,
  background: '#ffffff', appearance: 'auto',
}

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: 16, padding: '10px 14px',
  border: '2px solid #b4b2a9', borderRadius: 8,
  boxSizing: 'border-box',
}
