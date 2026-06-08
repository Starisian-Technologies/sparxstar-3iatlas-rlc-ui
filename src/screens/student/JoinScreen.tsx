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
      if ('requires_screen_name' in result && result.requires_screen_name) {
        // Lower Basic (contract §3.4 step 1): server returns roster, student picks a name
        setRoster(result.session_screen_names ?? [])
        setPhase('roster')
      } else {
        // Per contract §3.4, code-only probe is Lower-Basic-step-1 only.
        // Any other response shape (incl. a full SessionJoinResponse) is
        // off-contract — fall back to name entry so we don't proceed with
        // an empty display_name that breaks leaderboard/avatar matching.
        setCredMode('none')
        setPhase('simple_name')
        requestAnimationFrame(() => nameRef.current?.focus())
      }
    } catch (err) {
      // Server may return a structured error with tier info (Upper Basic / SS).
      // Also handle 423 (account locked) and 410 (session unavailable).
      const parsed = parseJoinError(err)
      if (parsed.type === 'tier') {
        const mode = tierToCredMode(parsed.tier)
        setCredMode(mode)
        setPhase(mode === 'none' ? 'simple_name' : 'credentials')
        requestAnimationFrame(() => nameRef.current?.focus())
      } else if (parsed.type === 'session_unavailable') {
        setError('This session has ended or the code has expired.')
        setPhase('code')
        requestAnimationFrame(() => codeRef.current?.focus())
      } else {
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
      if (!('participant_id' in result)) {
        setError('Unexpected server response. Please try again.')
        setLoading(false)
        return
      }
      onJoined({ ...result, display_name: screenName })
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
      const payload =
        credMode === 'pin' && pin
          ? { join_code: code, screen_name: name.trim(), pin }
          : credMode === 'password' && password
          ? { join_code: code, screen_name: name.trim(), password }
          : { join_code: code, screen_name: name.trim() }
      const result = await api.session.join(payload)
      if (!('participant_id' in result)) {
        setError('Unexpected server response. Please try again.')
        setLoading(false)
        return
      }
      onJoined({ ...result, display_name: name.trim() })
    } catch (err) {
      const parsed = parseJoinError(err)
      if (parsed.type === 'locked') {
        setError('Account locked after too many attempts. Ask your teacher to unlock it.')
      } else if (parsed.type === 'invalid_credential') {
        const remaining = parsed.remaining
        setError(
          credMode === 'pin'
            ? `Wrong PIN.${remaining != null ? ` ${remaining} attempt${remaining !== 1 ? 's' : ''} left.` : ''} Ask your teacher if locked.`
            : `Wrong password.${remaining != null ? ` ${remaining} attempt${remaining !== 1 ? 's' : ''} left.` : ''}`,
        )
      } else {
        setError(
          credMode === 'pin' ? 'Wrong PIN. Try again or ask your teacher.'
          : credMode === 'password' ? 'Wrong password. Try again.'
          : 'Could not join. Check your code and try again.',
        )
      }
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

type ParsedJoinError =
  | { type: 'tier'; tier: StudentTier }
  | { type: 'locked' }
  | { type: 'invalid_credential'; remaining: number | null }
  | { type: 'session_unavailable' }
  | { type: 'unknown' }

function parseJoinError(err: unknown): ParsedJoinError {
  if (!(err instanceof Error)) return { type: 'unknown' }

  // API errors are formatted as "API {status}: {body}"
  const statusMatch = err.message.match(/^API (\d+):/)
  const status = statusMatch ? Number(statusMatch[1]) : 0

  // Try to extract JSON body from the error message
  let body: Record<string, unknown> = {}
  try {
    const jsonMatch = err.message.match(/\{[\s\S]*\}/)
    if (jsonMatch) body = JSON.parse(jsonMatch[0]) as Record<string, unknown>
  } catch { /* non-JSON */ }

  if (status === 423 || body['error'] === 'account_locked') return { type: 'locked' }
  if (status === 401 || body['error'] === 'credential_invalid') {
    return { type: 'invalid_credential', remaining: typeof body['remaining_attempts'] === 'number' ? body['remaining_attempts'] : null }
  }
  if (status === 410 || body['error'] === 'session_unavailable') return { type: 'session_unavailable' }

  // tier info returned on an error — Upper Basic / SS needs credentials
  const tier = body['tier'] as StudentTier | undefined
  if (tier === 'upper_basic' || tier === 'senior_secondary') return { type: 'tier', tier }

  // Plain-text tier keywords in message body (fallback)
  const text = err.message.toLowerCase()
  if (text.includes('upper_basic')) return { type: 'tier', tier: 'upper_basic' }
  if (text.includes('senior_secondary')) return { type: 'tier', tier: 'senior_secondary' }

  return { type: 'unknown' }
}
