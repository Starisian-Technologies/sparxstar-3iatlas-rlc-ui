import type { RoundCompleteSummary } from '@/types'

interface RoundCompleteScreenProps {
  summary: RoundCompleteSummary
  onNextRound: () => void
  onBackToLobby: () => void
}

export function RoundCompleteScreen({ summary, onNextRound, onBackToLobby }: RoundCompleteScreenProps) {
  return (
    <div style={wrapStyle}>
      <header style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 800 }}>Round Complete! 🎉</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>You collected</div>
        <div style={{ fontSize: 78, lineHeight: 1, fontWeight: 900, color: 'var(--accent-primary)' }}>
          {summary.words_collected}
        </div>
        <div style={{ fontSize: 40, color: 'var(--accent-primary)', fontWeight: 800 }}>words</div>
      </header>

      <section style={cardRowStyle}>
        <div style={metricCardStyle}>
          <div style={{ fontSize: 30 }}>⭐</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>+{summary.points_earned}</div>
          <div style={{ color: 'var(--text-secondary)' }}>Points earned</div>
        </div>
        <div style={metricCardStyle}>
          <div style={{ fontSize: 30 }}>✨</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>+{summary.stars_earned}</div>
          <div style={{ color: 'var(--text-secondary)' }}>Stars earned</div>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Top Words</div>
        {summary.top_words.map((word) => (
          <div key={word.id} style={topWordRowStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{word.word}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{word.translation ?? '—'}</div>
            </div>
            <div style={{ color: 'var(--gold)', fontWeight: 700 }}>+{word.points} ⭐</div>
          </div>
        ))}
      </section>

      <section style={scoreRowStyle}>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Your Score</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{summary.player_score} ⭐</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Ranking</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>
            {summary.player_rank}
            <span style={{ fontSize: 18, color: 'var(--text-secondary)' }}> / {summary.total_players}</span>
          </div>
        </div>
      </section>

      <button type="button" onClick={onNextRound} style={primaryBtnStyle}>Next Round</button>
      <button type="button" onClick={onBackToLobby} style={secondaryBtnStyle}>Back to Lobby</button>
    </div>
  )
}

const wrapStyle: React.CSSProperties = {
  minHeight: '100dvh',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const cardRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
}

const metricCardStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
}

const panelStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const topWordRowStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.03)',
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const scoreRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 14,
}

const primaryBtnStyle: React.CSSProperties = {
  minHeight: 52,
  borderRadius: 12,
  border: 'none',
  background: 'var(--accent-primary)',
  color: 'var(--text-primary)',
  fontSize: 18,
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  minHeight: 52,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-primary)',
  fontSize: 18,
  fontWeight: 700,
  cursor: 'pointer',
}
