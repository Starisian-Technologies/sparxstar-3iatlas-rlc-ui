/**
 * T1 — Teacher session setup screen.
 *
 * Teachers pick collection mode, language, semantic domain, duration, and
 * collection depth. The list of languages and domains is fetched from the
 * dictionary API at `window.DICT_API_BASE` or `VITE_DICTIONARY_API_URL`,
 * with a baked-in fallback (Mandinka / Agriculture) so the teacher can
 * still start a session if the dictionary endpoint is offline.
 */
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { TenantLogo } from '@/components/TenantLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/theme/useTheme'
import { placeholderRights } from '@/runtime/rights'
import type { CollectionMode, CollectionDepth, CreateSessionResponse } from '@/types'

function getClassId(): string | null {
  if (typeof window === 'undefined') return null
  const v = (window as unknown as Record<string, unknown>)['RLC_CLASS_ID']
  return typeof v === 'string' && v.length > 0 ? v : null
}

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
const DICT_FETCH_TIMEOUT_MS = 8000

function useDictionarySetup(selectedLang: string) {
  const [languages, setLanguages] = useState<DictLanguage[]>([])
  const [domains, setDomains] = useState<DictDomain[]>([])
  const [languagesLoaded, setLanguagesLoaded] = useState(false)
  const [domainsLoaded, setDomainsLoaded] = useState(false)

  useEffect(() => {
    if (!DICT_BASE) {
      setLanguages(FALLBACK_LANGUAGES)
      setDomains(FALLBACK_DOMAINS)
      setLanguagesLoaded(true)
      setDomainsLoaded(true)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), DICT_FETCH_TIMEOUT_MS)
    setLanguagesLoaded(false)
    void fetch(`${DICT_BASE}/languages`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() as Promise<{ data: { languages: DictLanguage[] } }> : Promise.reject(new Error(`Languages API failed with status ${r.status}`))))
      .then((data) => {
        if (!cancelled) {
          setLanguages(data.data.languages.length > 0 ? data.data.languages : FALLBACK_LANGUAGES)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLanguages(FALLBACK_LANGUAGES)
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
        if (!cancelled) {
          setLanguagesLoaded(true)
        }
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!DICT_BASE || !selectedLang) return

    let cancelled = false
    const controller = new AbortController()
    setDomainsLoaded(false)

    void fetch(`${DICT_BASE}/domains?lang_source=${selectedLang}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() as Promise<{ data: { domains: DictDomain[] } }> : Promise.reject(new Error(`Domains API failed with status ${r.status}`))))
      .then((data) => {
        if (!cancelled) {
          setDomains(data.data.domains.length > 0 ? data.data.domains : FALLBACK_DOMAINS)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
          setDomains(FALLBACK_DOMAINS)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDomainsLoaded(true)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedLang])

  const isLanguageValid = languages.some((language) => language.slug === selectedLang)
  const ready = languagesLoaded && domainsLoaded && !!selectedLang && isLanguageValid && domains.length > 0

  return { languages, domains, ready }
}

export function SetupScreen({ onCreated }: SetupScreenProps) {
  const { tokens } = useTheme()
  const [mode, setMode] = useState<CollectionMode>('rwc')
  const [language, setLanguage] = useState('mandinka')
  const [domain, setDomain] = useState('agriculture-6.2')
  const [duration, setDuration] = useState(15)
  // First slice: full-depth/audio is its own slice. Only translation_only + basic
  // are surfaced here; the recording gate (GET /class/:id + 422 backstop) ships
  // with the full slice.
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
      setDomain((currentDomain) => {
        return domains.some((d) => d.slug === currentDomain) ? currentDomain : domains[0].slug
      })
    }
  }, [domains])

  const handleCreate = async () => {
    const class_id = getClassId()
    if (!class_id) {
      setError('Missing class context. Please reload from the orchestrator.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await api.session.create({
        mode,
        language,
        // Locale follows language for this slice — regional variants come later.
        locale: language,
        semantic_domain_id: domain,
        duration_minutes: duration,
        collection_depth: depth,
        class_id,
        rights: placeholderRights(),
      })
      onCreated({ ...result, mode, collection_depth: depth, language })
    } catch {
      setError('Could not create session. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 48,
    padding: '0 12px',
    background: tokens.bg,
    color: tokens.text,
    border: `1.5px solid ${tokens.border}`,
    borderRadius: 12,
    fontSize: 16,
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none' stroke='%23${tokens.textMuted.replace('#', '')}' stroke-width='2'%3e%3cpath d='M1 1l5 5 5-5'/%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: 36,
  }

  return (
    <Screen
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <TenantLogo size="medium" />
          <ThemeToggle />
        </div>
      }
      footer={
        <Button onClick={() => void handleCreate()} disabled={loading || !ready} large>
          {loading ? 'Creating…' : 'Create session'}
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420, margin: '0 auto', width: '100%' }}>
        <div>
          <div style={{ fontSize: 13, color: tokens.textMuted, letterSpacing: 1, fontWeight: 700 }}>TEACHER</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: tokens.text, margin: '4px 0 0 0' }}>New session</h1>
        </div>

        <Card>
          <Field label="Mode">
            <SegmentedControl
              options={[
                { value: 'rwc', label: 'Words' },
                { value: 'rsc', label: 'Sentences' },
              ]}
              value={mode}
              onChange={(v) => setMode(v as CollectionMode)}
            />
          </Field>
        </Card>

        <Card>
          <Field label="Language">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={!ready}
              style={selectStyle}
              aria-label="Session language"
            >
              {languages.map((l) => (
                <option key={l.slug} value={l.slug} style={{ background: tokens.bg, color: tokens.text }}>{l.name}</option>
              ))}
            </select>
          </Field>

          <div style={{ height: 12 }} />

          <Field label="Topic">
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={!ready}
              style={selectStyle}
              aria-label="Semantic domain"
            >
              {domains.map((d) => (
                <option key={d.slug} value={d.slug} style={{ background: tokens.bg, color: tokens.text }}>{d.name}</option>
              ))}
            </select>
          </Field>
        </Card>

        <Card>
          <Field label="Round duration">
            <SegmentedControl
              options={DURATIONS.map((d) => ({ value: String(d), label: `${d} min` }))}
              value={String(duration)}
              onChange={(v) => setDuration(Number(v))}
            />
          </Field>

          <div style={{ height: 14 }} />

          <Field label="Collection depth">
            <SegmentedControl
              options={[
                { value: 'translation_only', label: 'Word + translation' },
                { value: 'basic', label: 'Word only' },
              ]}
              value={depth}
              onChange={(v) => setDepth(v as CollectionDepth)}
            />
          </Field>
        </Card>

        {error && (
          <div
            role="alert"
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: `1px solid ${tokens.danger}`,
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 14,
              color: tokens.danger,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </Screen>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { tokens } = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: tokens.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
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
  const { tokens } = useTheme()
  return (
    <div
      role="radiogroup"
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: tokens.bg,
        border: `1px solid ${tokens.border}`,
        borderRadius: 12,
      }}
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            style={{
              flex: '1 1 0',
              minHeight: 40,
              padding: '0 12px',
              fontSize: 14,
              fontWeight: 700,
              background: selected ? tokens.primary : 'transparent',
              color: selected ? tokens.textInverse : tokens.textMuted,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'background 80ms ease, color 80ms ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
