/**
 * T0 — Teacher login screen.
 *
 * Accounts service is complete on the Node engine (POST /api/v1/auth/login).
 * This screen gates the teacher flow: on success the JWT is stored in
 * localStorage so `getTeacherToken()` in client.ts picks it up for all
 * subsequent teacher-authenticated calls.
 *
 * The `window.RLC_TEACHER_TOKEN` path still works — the WordPress orchestrator
 * can inject a pre-issued token directly and skip this screen entirely.
 */
import { useState } from 'react'
import { api } from '@/api/client'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { TenantLogo } from '@/components/TenantLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/theme/useTheme'

interface TeacherLoginScreenProps {
  onLoggedIn: () => void
  onBack: () => void
}

export function TeacherLoginScreen({ onLoggedIn, onBack }: TeacherLoginScreenProps) {
  const { tokens } = useTheme()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = username.trim().length > 0 && password.length > 0 && !loading

  const handleLogin = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.auth.login({ username: username.trim(), password })
      // Store in localStorage so getTeacherToken() finds it on subsequent calls.
      localStorage.setItem('RLC_TEACHER_TOKEN', result.token)
      // Also poke the window property so same-session requests pick it up
      // without waiting for a re-render.
      ;(window as unknown as Record<string, string>)['RLC_TEACHER_TOKEN'] = result.token
      // School context — recording_enabled gates audio capture in T1.
      if (result.school) {
        const ctx = JSON.stringify(result.school)
        try { localStorage.setItem('RLC_SCHOOL_CONTEXT', ctx) } catch { /* ignore */ }
        ;(window as unknown as Record<string, string>)['RLC_SCHOOL_CONTEXT'] = ctx
      }
      onLoggedIn()
    } catch {
      setError('Incorrect username or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
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
      footer={
        <Button onClick={() => void handleLogin()} disabled={!canSubmit} large>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 380, margin: '0 auto', width: '100%' }}>
        <div>
          <div style={{ fontSize: 13, color: tokens.textMuted, letterSpacing: 1, fontWeight: 700 }}>TEACHER</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: tokens.text, margin: '4px 0 0 0' }}>Sign in</h1>
          <div style={{ fontSize: 14, color: tokens.textMuted, marginTop: 4 }}>
            Your school credentials — ask your administrator if you need help.
          </div>
        </div>

        <Card pad={20}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                htmlFor="teacher-username"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: tokens.textMuted }}
              >
                Username
              </label>
              <input
                id="teacher-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="your.name@school"
                style={inputStyle}
                aria-label="Teacher username"
                onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('teacher-password')?.focus() }}
              />
            </div>

            <div>
              <label
                htmlFor="teacher-password"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: tokens.textMuted }}
              >
                Password
              </label>
              <input
                id="teacher-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                style={inputStyle}
                aria-label="Teacher password"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleLogin() }}
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

        <button
          type="button"
          onClick={onBack}
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
          ← Back
        </button>
      </div>
    </Screen>
  )
}
