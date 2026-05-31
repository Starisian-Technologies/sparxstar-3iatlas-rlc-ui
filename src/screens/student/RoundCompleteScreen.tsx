/**
 * RoundCompleteScreen — the celebration moment after a round closes.
 *
 * This is one of the two "wow" beats in the game loop (Ceremony is the other).
 * Visual hierarchy: huge word count → reward chips → top words → rank, with
 * fireworks in the background. Designed to feel rewarding even on a Tecno
 * Spark, so the celebration is pure SVG + a single drop-shadow glow on the
 * primary number, no expensive blur/filter chains.
 */
import { Fireworks } from '@/components/Fireworks'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { StarBadge } from '@/components/StarBadge'
import { useTheme } from '@/theme/useTheme'
import type { RoundCompleteSummary } from '@/types'

interface RoundCompleteScreenProps {
  summary: RoundCompleteSummary
  onNextRound: () => void
  onBackToLobby: () => void
}

export function RoundCompleteScreen({ summary, onNextRound, onBackToLobby }: RoundCompleteScreenProps) {
  const { tokens, resolved } = useTheme()
  const isDark = resolved === 'dark'

  return (
    <Screen
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button onClick={onNextRound} large>Next round</Button>
          <Button onClick={onBackToLobby} variant="ghost">Back to lobby</Button>
        </div>
      }
    >
      <Fireworks />

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8 }}>
        <div style={{ fontSize: 13, letterSpacing: 2, color: tokens.primary, fontWeight: 800 }}>
          ROUND {summary.round} COMPLETE
        </div>
        <div style={{ color: tokens.textMuted, fontSize: 15 }}>You collected</div>
        <div
          style={{
            fontSize: 96,
            lineHeight: 1,
            fontWeight: 900,
            color: tokens.primary,
            margin: '6px 0 0 0',
            letterSpacing: -4,
            textShadow: isDark ? `0 0 36px ${tokens.glow}` : 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {summary.words_collected}
        </div>
        <div style={{ fontSize: 28, color: tokens.text, fontWeight: 700, marginTop: -4 }}>
          {summary.words_collected === 1 ? 'word' : 'words'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
        <RewardChip
          icon={<StarBadge variant="gold" size={28} />}
          value={`+${summary.points_earned}`}
          label="Points earned"
        />
        <RewardChip
          icon={<StarBadge variant="discovery" size={28} />}
          value={`+${summary.stars_earned}`}
          label={summary.stars_earned === 1 ? 'Star earned' : 'Stars earned'}
        />
      </div>

      {summary.top_words.length > 0 && (
        <Card highlight>
          <div style={{ fontWeight: 800, fontSize: 18, color: tokens.text, marginBottom: 10 }}>Your top words</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summary.top_words.map((word) => (
              <div
                key={word.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  border: `1px solid ${tokens.border}`,
                  borderRadius: 10,
                  background: tokens.bg,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: tokens.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {word.word}
                  </div>
                  <div style={{ color: tokens.textMuted, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {word.translation ?? 'No translation yet'}
                  </div>
                </div>
                <StarBadge variant="gold" count={`+${word.xp_awarded}`} label={`${word.xp_awarded} XP`} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: tokens.textMuted, fontSize: 12, letterSpacing: 0.5, fontWeight: 600 }}>YOUR SCORE</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: tokens.text, fontVariantNumeric: 'tabular-nums' }}>
              {summary.player_score.toLocaleString()}
              <span style={{ color: tokens.gold, marginLeft: 6 }}>XP</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: tokens.textMuted, fontSize: 12, letterSpacing: 0.5, fontWeight: 600 }}>RANK</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: tokens.text, fontVariantNumeric: 'tabular-nums' }}>
              #{summary.player_rank}
              <span style={{ color: tokens.textMuted, fontSize: 16, marginLeft: 4 }}>of {summary.total_players}</span>
            </div>
          </div>
        </div>
      </Card>
    </Screen>
  )
}

function RewardChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  const { tokens, resolved } = useTheme()
  return (
    <Card pad={14} style={{ alignItems: 'center', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ marginBottom: 2 }}>{icon}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: tokens.text,
          textShadow: resolved === 'dark' ? `0 0 12px ${tokens.glow}` : 'none',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div style={{ color: tokens.textMuted, fontSize: 12 }}>{label}</div>
    </Card>
  )
}
