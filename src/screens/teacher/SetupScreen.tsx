import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import type { CollectionMode, CollectionDepth, CreateSessionResponse } from '@/types'

interface SetupScreenProps {
  onCreated: (result: CreateSessionResponse & { mode: CollectionMode; collection_depth: CollectionDepth; language: string }) => void
}

const DICT_BASE: string =
  (window as unknown as Record<string, string>)['DICT_API_BASE'] ??
  (import.meta.env['VITE_DICTIONARY_API_URL'] as string | undefined) ??
  ''

interface DictLanguage { slug: string; name: string; count: number }
interface DictDomain { slug: string; name: string; code: string; count: number }

const FALLBACK_LANGUAGES: DictLanguage[] = [
  { slug: 'mandinka', name: 'Mandinka', count: 0 },
]

const FALLBACK_DOMAINS: DictDomain[] = [
  { slug: 'agriculture-6.2', name: 'Agriculture', code: '6.2', count: 0 },
]

const DURATIONS = [5, 10, 15, 20]

function useDictionarySetup(selectedLang: string) {
  const [languages, setLanguages] = useState<DictLanguage[]>([])
  const [domains, setDomains] = useState<DictDomain[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!DICT_BASE) {
      setLanguages(FALLBACK_LANGUAGES)
      setDomains(FALLBACK_DOMAINS)
      setReady(true)
      return
    }

    void fetch(`${DICT_BASE}/languages`)
      .then((r) => (r.ok ? r.json() as Promise<{ data: { languages: DictLanguage[] } }> : Promise.reject(new Error(`Languages API failed with status ${r.status}`))))
      .then((data) => setLanguages(data.data.languages.length > 0 ? data.data.languages : FALLBACK_LANGUAGES))
      .catch(() => setLanguages(FALLBACK_LANGUAGES))
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!DICT_BASE || !selectedLang) return

    void fetch(`${DICT_BASE}/domains?lang_source=${selectedLang}`)
      .then((r) => (r.ok ? r.json() as Promise<{ data: { domains: DictDomain[] } }> : Promise.reject(new Error(`Domains API failed with status ${r.status}`))))
      .then((data) => setDomains(data.data.domains.length > 0 ? data.data.domains : FALLBACK_DOMAINS))
      .catch(() => setDomains(FALLBACK_DOMAINS))
  }, [selectedLang])

  return { languages, domains, ready }
}

/**
 * T1 — Teacher session setup screen.
 * Select mode, language, semantic domain, duration, collection depth.
 */
export function SetupScreen({ onCreated }: SetupScreenProps) {
  const [mode, setMode] = useState<CollectionMode>('rwc')
  const [language, setLanguage] = useState('mandinka')
  const [domain, setDomain] = useState('agriculture-6.2')
  const [duration, setDuration] = useState(15)
  const [depth, setDepth] = useState<CollectionDepth>('translation_only')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { languages, domains, ready } = useDictionarySetup(language)

  useEffect(() => {
    if (languages.length > 0 && !languages.some((l) => l.slug === language)) {
      setLanguage(languages[0].slug)
    }
  }, [languages, language])

  useEffect(() => {
    if (domains.length > 0) {
      setDomain(domains[0].slug)
    }
  }, [domains])

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
          disabled={!ready}
          style={{ minHeight: 44, width: '100%' }}
          aria-label="Session language"
        >
          {languages.map((l) => (
            <option key={l.slug} value={l.slug}>{l.name}</option>
          ))}
        </select>
      </Field>

      {/* Semantic domain */}
      <Field label="Semantic domain">
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          disabled={!ready}
          style={{ minHeight: 44, width: '100%' }}
          aria-label="Semantic domain"
        >
          {domains.map((d) => (
            <option key={d.slug} value={d.slug}>{d.name}</option>
          ))}
        </select>
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
        <div style={{ fontSize: 12, color: 'var(--accent-secondary)', marginTop: 6 }}>
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
        disabled={loading || !ready}
        style={{
          minHeight: 52, fontSize: 18, fontWeight: 700,
          background: (loading || !ready) ? '#b4b2a9' : '#1B3A6B',
          color: '#ffffff', border: 'none', borderRadius: 10,
          cursor: (loading || !ready) ? 'not-allowed' : 'pointer', marginTop: 8,
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
