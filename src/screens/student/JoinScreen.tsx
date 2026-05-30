/**
 * S1 — Tier-aware student join screen (spec §1.5, §6.3).
 *
 * Phase 1 (all tiers): 6-character join code.
 *
 * On code complete, the screen probes `POST /session/join` with just the code:
 *   • Server returns session_screen_names → Lower Basic roster grid (Phase 2a)
 *   • Server returns tier = 'upper_basic'  → name + 4-digit PIN (Phase 2b)
 *   • Server returns tier = 'senior_secondary' → name + password (Phase 2c)
 *   • Probe returns no tier info → graceful fallback to simple name entry (Phase 2d)
 *
 * Lower Basic students tap their Adinkra avatar from the class roster — no typing.
 * Upper Basic students type their name and 4-digit PIN.
 * Senior Secondary students type their name and password.
 */
import { useState, useRef } from 'react'
import { api } from '@/api/client'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TenantLogo } from '@/components/TenantLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Screen } from '@/components/Screen'
import { useTheme } from '@/theme/useTheme'
import type { JoinSessionResponse, StudentTier } from '@/types'

interface JoinScreenProps {
  onJoined: (result: JoinSessionResponse & { display_name: string }) => void
}

type Phase =
  | 'code'
  | 'probing'
  | 'roster'          // Lower Basic — tap your name
  | 'credentials'     // Upper Basic (PIN) or Senior Secondary (password)
  | 'simple_name'     // Fallback / Adult — type your name

type CredentialMode = 'pin' | 'password' | 'none'

export function JoinScreen({ onJoined }: JoinScreenProps) {
  const { tokens } = useTheme()
  const [phase, setPhase] = useState<Phase>('code')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [roster, setRoster] = useState<string[]>([])
  const [credMode, setCredMode] = useState<CredentialMode>('none')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setCode(v)
    setError(null)
    if (v.length === 6) void probeCode(v)
  }

  // Probe the server with just the join code to determine tier / roster.
  const probeCode = async (joinCode: string) => {
    setPhase('probing')
    setError(null)
    try {
      const result = await api.session.join({ join_code: joinCode })
      if (result.session_screen_names && result.session_screen_names.length > 0) {
        // Lower Basic: server returned roster without full join
        setRoster(result.session_screen_names)
        setPhase('roster')
      } else if (result.participant_id) {
        // Unexpected: server fully joined on code-only probe (anonymous guest mode)
        onJoined({ ...result, display_name: result.display_name ?? '' })
      } else {
        // No roster, no participant — tier info should tell us what to show
        const mode = tierToCredMode(result.tier)
        setCredMode(mode)
        setPhase(mode === 'none' ? 'simple_name' : 'credentials')
        requestAnimationFrame(() => nameRef.current?.focus())
      }
    } catch (err) {
      // Server may return 403 with tier info for Upper Basic / Senior Secondary.
      // Try to parse the error body; fall back to simple name form.
      const tier = extractTierFromError(err)
      if (tier) {
        const mode = tierToCredMode(tier)
        setCredMode(mode)
        setPhase(mode === 'none' ? 'simple_name' : 'credentials')
        requestAnimationFrame(() => nameRef.current?.focus())
      } else {
        // Code invalid or session closed
        setError('Code not found. Check the board and try again.')
        setPhase('code')
        requestAnimationFrame(() => codeRef.current?.focus())
      }
    }
  }

  const handleRosterSelect = async (screenName: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.session.join({ join_code: code, screen_name: screenName })
      onJoined({ ...result, display_name: result.display_name ?? screenName })
    } catch {
      setError('Could not join. Please try again.')
      setLoading(false)
    }
  }

  const handleCredentialsJoin = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.session.join({
        join_code: code,
        screen_name: name.trim(),
        ...(credMode === 'pin' && pin ? { pin } : {}),
        ...(credMode === 'password' && password ? { password } : {}),
      })
      onJoined({ ...result, display_name: result.display_name ?? name.trim() })
    } catch {
      setError(
        credMode === 'pin'
          ? 'Wrong PIN. Try again or ask your teacher.'
          : credMode === 'password'
          ? 'Wrong password. Try again.'
          : 'Could not join. Check your code and try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    background: tokens.bg,
    color: tokens.text,
    border: `1.5px solid ${tokens.border}`,
    borderRadius: 12,
    outline: 'none',
    boxSizing: 'border-box',
    fontSize: 18,
  }

  // ── Phase: enter code ───────────────────────────────────────────────────────
  if (phase === 'code' || phase === 'probing') {
    const isProbing = phase === 'probing'
    return (
      <Screen
        header={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <TenantLogo size="medium" />
            <ThemeToggle />
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 380, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: tokens.text, margin: 0 }}>Join the session</h1>
            <div style={{ color: tokens.textMuted, fontSize: 14 }}>
              Ask your teacher for the code on the board.
            </div>
          </div>

          <Card pad={20}>
            <label
              htmlFor="join-code"
              style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: tokens.textMuted }}
            >
              Session code
            </label>
            <input
              id="join-code"
              ref={codeRef}
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={code}
              onChange={handleCodeChange}
              disabled={isProbing}
              placeholder="ABC123"
              style={{
                ...inputBase,
                fontSize: 32,
                fontWeight: 800,
                textAlign: 'center',
                letterSpacing: 8,
                fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
                opacity: isProbing ? 0.5 : 1,
              }}
              aria-label="Six character session code"
            />

            {isProbing && (
              <div style={{ textAlign: 'center', marginTop: 12, color: tokens.textMuted, fontSize: 14 }}>
                Looking up session…
              </div>
            )}

            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  background: 'rgba(239,68,68,0.12)',
                  border: `1px solid ${tokens.danger}`,
                  color: tokens.danger,
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}
          </Card>
        </div>
      </Screen>
    )
  }

  // ── Phase: Lower Basic roster grid ──────────────────────────────────────────
  if (phase === 'roster') {
    return (
      <Screen
        header={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <TenantLogo size="medium" />
            <ThemeToggle />
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: tokens.text, margin: 0 }}>Who are you?</h1>
            <div style={{ color: tokens.textMuted, fontSize: 14 }}>Tap your name to join.</div>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: `1px solid ${tokens.danger}`,
                color: tokens.danger,
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 10,
          }}>
            {roster.map((screenName) => (
              <RosterTile
                key={screenName}
                screenName={screenName}
                disabled={loading}
                onSelect={() => void handleRosterSelect(screenName)}
                tokens={tokens}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => { setCode(''); setPhase('code'); setError(null) }}
            style={{
              background: 'none',
              border: 'none',
              color: tokens.textMuted,
              fontSize: 14,
              cursor: 'pointer',
              padding: '4px 0',
              textAlign: 'center',
            }}
          >
            ← Wrong code?
          </button>
        </div>
      </Screen>
    )
  }

  // ── Phase: name + credentials (Upper Basic / Senior Secondary / fallback) ───
  const isPin = credMode === 'pin'
  const isPassword = credMode === 'password'
  const hasName = name.trim().length > 0
  const credFilled = credMode === 'none' || (isPin && pin.length === 4) || (isPassword && password.length > 0)
  const canJoin = hasName && credFilled && !loading

  return (
    <Screen
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <TenantLogo size="medium" />
          <ThemeToggle />
        </div>
      }
      footer={
        <Button onClick={() => void handleCredentialsJoin()} disabled={!canJoin} large>
          {loading ? 'Joining…' : 'Join'}
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 380, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: tokens.text, margin: 0 }}>Join the session</h1>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            justifyContent: 'center',
            fontSize: 14,
            color: tokens.textMuted,
          }}>
            Code:
            <span style={{
              fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
              fontWeight: 800,
              color: tokens.primary,
              letterSpacing: 4,
              fontSize: 16,
            }}>
              {code}
            </span>
          </div>
        </div>

        {hasName && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <Avatar seed={name.trim()} size={72} highlight />
            <div style={{ color: tokens.textMuted, fontSize: 12 }}>
              That&rsquo;s your symbol — tap to learn its meaning later
            </div>
          </div>
        )}

        <Card pad={20}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                htmlFor="display-name"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: tokens.textMuted }}
              >
                Your name
              </label>
              <input
                id="display-name"
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                maxLength={40}
                autoComplete="given-name"
                style={inputBase}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isPassword) void handleCredentialsJoin() }}
              />
            </div>

            {isPin && (
              <div>
                <label
                  htmlFor="student-pin"
                  style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: tokens.textMuted }}
                >
                  PIN (4 digits)
                </label>
                <input
                  id="student-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="••••"
                  autoComplete="current-password"
                  style={{
                    ...inputBase,
                    fontSize: 28,
                    letterSpacing: 12,
                    textAlign: 'center',
                    fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
                  }}
                  aria-label="4-digit PIN"
                />
              </div>
            )}

            {isPassword && (
              <div>
                <label
                  htmlFor="student-password"
                  style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: tokens.textMuted }}
                >
                  Password
                </label>
                <input
                  id="student-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  style={inputBase}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleCredentialsJoin() }}
                  aria-label="Password"
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: `1px solid ${tokens.danger}`,
                  color: tokens.danger,
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}
          </div>
        </Card>

        <button
          type="button"
          onClick={() => { setCode(''); setPhase('code'); setError(null); setName(''); setPin(''); setPassword('') }}
          style={{
            background: 'none',
            border: 'none',
            color: tokens.textMuted,
            fontSize: 14,
            cursor: 'pointer',
            padding: '4px 0',
            textAlign: 'center',
          }}
        >
          ← Wrong code?
        </button>
      </div>
    </Screen>
  )
}

function RosterTile({
  screenName,
  disabled,
  onSelect,
  tokens,
}: {
  screenName: string
  disabled: boolean
  onSelect: () => void
  tokens: {
    card: string; cardElevated: string; border: string; primary: string
    primarySoft: string; glow: string; text: string; textMuted: string
  }
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={`Join as ${screenName}`}
      style={{
        background: hovered ? tokens.cardElevated : tokens.card,
        border: `1.5px solid ${hovered ? tokens.primary : tokens.border}`,
        borderRadius: 16,
        padding: '14px 8px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        boxShadow: hovered ? `0 0 16px ${tokens.glow}` : 'none',
        transition: 'border-color 80ms ease, box-shadow 80ms ease, background 80ms ease',
        WebkitTapHighlightColor: 'transparent',
        minHeight: 100,
      }}
    >
      <Avatar seed={screenName} size={52} highlight={hovered} />
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: hovered ? tokens.primary : tokens.text,
        textAlign: 'center',
        wordBreak: 'break-word',
        lineHeight: 1.3,
        maxWidth: '100%',
      }}>
        {screenName}
      </div>
    </button>
  )
}

function tierToCredMode(tier: string | undefined): CredentialMode {
  if (tier === 'upper_basic') return 'pin'
  if (tier === 'senior_secondary') return 'password'
  return 'none'
}

function extractTierFromError(err: unknown): StudentTier | null {
  if (err instanceof Error) {
    const text = err.message.toLowerCase()
    if (text.includes('upper_basic')) return 'upper_basic'
    if (text.includes('senior_secondary')) return 'senior_secondary'
    // Try JSON parse from API response body embedded in the error message
    try {
      const match = err.message.match(/\{.*\}/s)
      if (match) {
        const body = JSON.parse(match[0]) as { tier?: StudentTier }
        if (body.tier) return body.tier
      }
    } catch {
      // Non-JSON error — not tier-related
    }
  }
  return null
}
