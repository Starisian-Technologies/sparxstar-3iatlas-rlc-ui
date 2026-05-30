/**
 * S1 — Student join screen.
 *
 * Tier-aware sign-in (PIN/password) lands in a follow-up. For the Gambia
 * usability pilot this screen is the simple join-code + screen-name path
 * the older mockups show. AccessoryBar will be wired into the name field
 * in a follow-up too (for non-Latin characters in screen names).
 *
 * Designed for 360px viewport. Hand-fed visual hierarchy: code first
 * (very large, monospaced, letter-spaced), name second, big primary CTA.
 */
import { useState, useRef } from 'react'
import { api } from '@/api/client'
import type { JoinSessionResponse } from '@/types'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { TenantLogo } from '@/components/TenantLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/theme/useTheme'

interface JoinScreenProps {
  onJoined: (result: JoinSessionResponse & { display_name: string }) => void
}

export function JoinScreen({ onJoined }: JoinScreenProps) {
  const { tokens } = useTheme()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
  }

  const handleJoin = async () => {
    if (code.length !== 6 || !name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.session.join(code, name.trim())
      onJoined({ ...result, display_name: result.display_name ?? name.trim() })
    } catch {
      setError('Could not join. Check your code and try again.')
    } finally {
      setLoading(false)
    }
  }

  const canJoin = code.length === 6 && name.trim().length > 0 && !loading
  const hasName = name.trim().length > 0

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
                htmlFor="join-code"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: tokens.textMuted }}
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
                placeholder="ABC123"
                style={{
                  ...inputBase,
                  fontSize: 32,
                  fontWeight: 800,
                  textAlign: 'center',
                  letterSpacing: 8,
                  fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
                }}
                aria-label="Six character session code"
              />
            </div>

            <div>
              <label
                htmlFor="display-name"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: tokens.textMuted }}
              >
                Your name
              </label>
              <input
                id="display-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                maxLength={40}
                autoComplete="given-name"
                style={inputBase}
              />
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
          </div>
        </Card>
      </div>

      <div style={{ maxWidth: 380, margin: '0 auto', width: '100%' }}>
        <Button onClick={() => void handleJoin()} disabled={!canJoin} large>
          {loading ? 'Joining…' : 'Join'}
        </Button>
      </div>
    </Screen>
  )
}
