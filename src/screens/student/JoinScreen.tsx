import { useState, useRef } from 'react'
import { api } from '@/api/client'
import type { JoinSessionResponse } from '@/types'

interface JoinScreenProps {
  onJoined: (result: JoinSessionResponse & { display_name: string }) => void
}

/**
 * S1 — Student join screen.
 * Full screen. Large 6-character code entry, auto-uppercase.
 * Display name. Join button.
 * Designed for 360px viewport on cheap Android phones.
 */
export function JoinScreen({ onJoined }: JoinScreenProps) {
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
      onJoined({ ...result, display_name: name.trim() })
    } catch {
      setError('Could not join. Check your code and try again.')
    } finally {
      setLoading(false)
    }
  }

  const canJoin = code.length === 6 && name.trim().length > 0 && !loading

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: '#1B3A6B',
      gap: 24,
    }}>
      <div style={{ textAlign: 'center', color: '#ffffff' }}>
        <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>3iAtlas</div>
        <div style={{ fontSize: 16, opacity: 0.8 }}>Rapid Language Collection</div>
      </div>

      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div>
          <label
            htmlFor="join-code"
            style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#1a1a1a' }}
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
              width: '100%',
              fontSize: 32,
              fontWeight: 700,
              textAlign: 'center',
              letterSpacing: 8,
              padding: '12px 16px',
              border: '2px solid #b4b2a9',
              borderRadius: 10,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'monospace',
            }}
            aria-label="Six character session code"
          />
        </div>

        <div>
          <label
            htmlFor="display-name"
            style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#1a1a1a' }}
          >
            Your name
          </label>
          <input
            id="display-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={40}
            style={{
              width: '100%',
              fontSize: 18,
              padding: '12px 16px',
              border: '2px solid #b4b2a9',
              borderRadius: 10,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div role="alert" style={{
            background: '#ffeded',
            border: '1px solid #f09595',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 14,
            color: '#a32d2d',
          }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleJoin()}
          disabled={!canJoin}
          style={{
            width: '100%',
            minHeight: 52,
            fontSize: 18,
            fontWeight: 700,
            background: canJoin ? '#1B3A6B' : '#b4b2a9',
            color: '#ffffff',
            border: 'none',
            borderRadius: 10,
            cursor: canJoin ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Joining…' : 'Join'}
        </button>
      </div>
    </div>
  )
}
