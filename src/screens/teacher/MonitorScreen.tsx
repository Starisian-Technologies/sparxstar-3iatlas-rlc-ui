import { useSessionPoll } from '@/hooks/useSessionPoll'
import type { LeaderboardEntry } from '@/types'

interface MonitorScreenProps {
  session_id: string
  join_code: string
  onEndCollection: () => void
}

/**
 * T2 — Teacher live monitor.
 * Large join code + QR placeholder. Live participant count.
 * Rolling leaderboard. End session button.
 */
export function MonitorScreen({ session_id, join_code, onEndCollection }: MonitorScreenProps) {
  const { session, error } = useSessionPoll(session_id, true)

  const minutes = session ? Math.floor(session.time_remaining_seconds / 60) : 0
  const seconds = session ? session.time_remaining_seconds % 60 : 0

  return (
    <div style={{
      minHeight: '100dvh', background: '#1B3A6B',
      color: '#ffffff', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>

      {/* Join code */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Join code</div>
        <div style={{
          fontSize: 56, fontWeight: 700, letterSpacing: 12,
          fontFamily: 'monospace', lineHeight: 1,
        }}>
          {join_code}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Stat label="Students" value={session?.participant_count ?? 0} />
        <Stat label="Words" value={session?.token_count ?? 0} />
        <Stat
          label="Time left"
          value={`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
        />
      </div>

      {error && (
        <div style={{ fontSize: 13, color: '#fac775', textAlign: 'center' }}>
          Connection issue — retrying…
        </div>
      )}

      {/* Leaderboard */}
      {session && session.leaderboard.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16,
          flex: 1, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, opacity: 0.8 }}>
            Live leaderboard
          </div>
          {session.leaderboard.map((entry: LeaderboardEntry) => (
            <LeaderRow key={entry.participant_id} entry={entry} />
          ))}
        </div>
      )}

      {/* End button */}
      <button
        type="button"
        onClick={onEndCollection}
        style={{
          minHeight: 52, fontSize: 16, fontWeight: 700,
          background: '#C9A84C', color: '#1B3A6B',
          border: 'none', borderRadius: 10, cursor: 'pointer',
        }}
      >
        End collection → Start QC
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      flex: 1, background: 'rgba(255,255,255,0.1)',
      borderRadius: 10, padding: '12px 8px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function LeaderRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{ fontSize: 14, opacity: 0.6, minWidth: 24, textAlign: 'right' }}>
        {entry.rank}
      </div>
      <div style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>
        {entry.display_name}
        {entry.is_teacher && (
          <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 6 }}>(teacher)</span>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#C9A84C' }}>
        {entry.xp} XP
      </div>
    </div>
  )
}
