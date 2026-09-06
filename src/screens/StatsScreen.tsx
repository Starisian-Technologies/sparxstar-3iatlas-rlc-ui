/**
 * Stats & Competition (NODE-ADR-011; canonical spec §6.7).
 *
 * THIS SCREEN CALCULATES NOTHING. Every number — weekly and lifetime XP,
 * accuracy, games played, stars, badges, gold, rank, and every leaderboard row —
 * arrives computed from the engine, which is the single scoring authority for
 * all 3iAtlas games. A client that derived a rank would be a second authority,
 * and two authorities that disagree is the defect the server-authoritative rule
 * exists to prevent. The only arithmetic here is turning an `accuracy` in 0..1
 * into a percentage for display.
 *
 * The board is pseudonymous by construction: rows carry a screen name and no
 * account id. The caller's own row is marked `is_self` by the server.
 *
 * Mobile-first, per the platform's Africa-first constraints: it renders at
 * 360px, every control clears 44px, and the two windows arrive in ONE response
 * so drawing this screen costs one round trip on a 2G link rather than two.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import { Screen } from '@/components/Screen'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { useTheme } from '@/theme/useTheme'
import type {
  AccountStatsResponse,
  LeaderboardEntry,
  SelfStatsWindow,
  StatsWindow,
} from '@/contract'

interface StatsScreenProps {
  account_id: string
  onBack: () => void
}

const PAGE_SIZE = 10

export function StatsScreen({ account_id, onBack }: StatsScreenProps) {
  const { t } = useTranslation()
  const { tokens } = useTheme()

  const [stats, setStats] = useState<AccountStatsResponse | null>(null)
  const [window_, setWindow] = useState<StatsWindow>('weekly')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingPref, setSavingPref] = useState(false)

  const loadBoard = useCallback(
    async (w: StatsWindow, band: AccountStatsResponse['band'] | undefined) => {
      // Scoped to the player's own band so the ranking is against a comparable
      // cohort — the mitigation the leaderboard supersession is conditional on.
      return api.stats.leaderboard({ window: w, band, limit: PAGE_SIZE })
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const mine = await api.stats.self(account_id)
        if (cancelled) return
        setStats(mine)
        const board = await loadBoard(window_, mine.band)
        if (cancelled) return
        setEntries(board.entries)
        setCursor(board.next_cursor)
      } catch {
        if (!cancelled) setError(t('stats.load_failed', { defaultValue: 'Could not load your stats. Please try again.' }))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [account_id, window_, loadBoard, t])

  const loadMore = async () => {
    if (!cursor || !stats) return
    setLoadingMore(true)
    try {
      const next = await api.stats.leaderboard({
        window: window_,
        band: stats.band,
        limit: PAGE_SIZE,
        cursor,
      })
      // Append rather than replace: keyset paging returns each row once, so the
      // accumulated list is the board so far, not a page that replaced another.
      setEntries((prev) => [...prev, ...next.entries])
      setCursor(next.next_cursor)
    } catch {
      setError(t('stats.load_more_failed', { defaultValue: 'Could not load more. Please try again.' }))
    } finally {
      setLoadingMore(false)
    }
  }

  const toggleOptOut = async () => {
    if (!stats) return
    setSavingPref(true)
    try {
      const result = await api.stats.setLeaderboardOptOut(account_id, !stats.leaderboard_opt_out)
      setStats({ ...stats, leaderboard_opt_out: result.opt_out })
      const board = await loadBoard(window_, stats.band)
      setEntries(board.entries)
      setCursor(board.next_cursor)
    } catch {
      setError(t('stats.pref_failed', { defaultValue: 'Could not change that setting. Please try again.' }))
    } finally {
      setSavingPref(false)
    }
  }

  if (loading) {
    return (
      <Screen centered>
        <div role="status" aria-busy="true" style={{ color: tokens.textMuted, textAlign: 'center' }}>
          {t('stats.loading', { defaultValue: 'Loading your stats…' })}
        </div>
      </Screen>
    )
  }

  if (error && !stats) {
    return (
      <Screen centered>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 }}>
          <div role="alert" style={{ color: tokens.danger, fontSize: 15 }}>{error}</div>
          <Button onClick={onBack} variant="ghost">
            {t('stats.back', { defaultValue: '← Back' })}
          </Button>
        </div>
      </Screen>
    )
  }

  const current: SelfStatsWindow | undefined = stats
    ? window_ === 'weekly'
      ? stats.weekly
      : stats.all_time
    : undefined

  return (
    <Screen
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: tokens.text, margin: 0 }}>
            {t('stats.title', { defaultValue: 'Your progress' })}
          </h1>
          <Button onClick={onBack} variant="ghost" fullWidth={false}>
            {t('stats.back', { defaultValue: '← Back' })}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420, margin: '0 auto', width: '100%' }}>
        <div
          role="radiogroup"
          aria-label={t('stats.window_label', { defaultValue: 'Time period' })}
          style={{ display: 'flex', gap: 4, padding: 4, background: tokens.bg, border: `1px solid ${tokens.border}`, borderRadius: 12 }}
        >
          {(['weekly', 'all_time'] as const).map((w) => {
            const selected = window_ === w
            return (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setWindow(w)}
                style={{
                  flex: '1 1 0',
                  minHeight: 44,
                  fontSize: 15,
                  fontWeight: 700,
                  background: selected ? tokens.primary : 'transparent',
                  color: selected ? tokens.textInverse : tokens.textMuted,
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                {w === 'weekly'
                  ? t('stats.this_week', { defaultValue: 'This week' })
                  : t('stats.all_time', { defaultValue: 'All time' })}
              </button>
            )
          })}
        </div>

        {stats && current && (
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <Stat label={t('stats.xp', { defaultValue: 'XP' })} value={String(current.xp)} />
              <Stat
                label={t('stats.rank', { defaultValue: 'Rank' })}
                value={
                  current.rank === null
                    ? t('stats.unranked', { defaultValue: 'Not ranked yet' })
                    : `#${current.rank}`
                }
              />
              <Stat
                label={t('stats.games_played', { defaultValue: 'Games played' })}
                value={String(current.games_played)}
              />
              <Stat
                label={t('stats.accuracy', { defaultValue: 'Accuracy' })}
                /* null means "nothing answered yet", NOT 0%. Rendering 0% would
                   tell a learner who has not played that they got everything
                   wrong. */
                value={
                  current.accuracy === null
                    ? t('stats.no_answers_yet', { defaultValue: '—' })
                    : `${Math.round(current.accuracy * 100)}%`
                }
              />
              <Stat label={t('stats.stars', { defaultValue: 'Stars' })} value={String(stats.stars)} />
              <Stat label={t('stats.gold', { defaultValue: 'Gold' })} value={String(stats.gold)} />
            </div>
          </Card>
        )}

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: tokens.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {window_ === 'weekly'
                ? t('stats.board_weekly', { defaultValue: 'Top 10 this week' })
                : t('stats.board_all_time', { defaultValue: 'Top 10 all time' })}
            </div>

            {stats?.leaderboard_opt_out && (
              <div role="status" style={{ fontSize: 13, color: tokens.textMuted, lineHeight: 1.5 }}>
                {t('stats.opted_out_note', {
                  defaultValue:
                    'You are hidden from this board. Your own progress above still shows your place.',
                })}
              </div>
            )}

            {entries.length === 0 && (
              <div style={{ fontSize: 14, color: tokens.textMuted }}>
                {t('stats.board_empty', { defaultValue: 'No scores yet. Be the first!' })}
              </div>
            )}

            {entries.map((entry) => (
              <BoardRow key={`${entry.rank}-${entry.screen_name}`} entry={entry} />
            ))}

            {cursor && (
              <Button onClick={() => void loadMore()} variant="ghost" disabled={loadingMore}>
                {loadingMore
                  ? t('stats.loading_more', { defaultValue: 'Loading…' })
                  : t('stats.show_more', { defaultValue: 'Show more' })}
              </Button>
            )}
          </div>
        </Card>

        {stats && (
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>
                {t('stats.privacy_heading', { defaultValue: 'Appearing on leaderboards' })}
              </div>
              <div style={{ fontSize: 13, color: tokens.textMuted, lineHeight: 1.5 }}>
                {t('stats.privacy_body', {
                  defaultValue:
                    'Boards only ever show your screen name. You can hide yourself at any time and still see your own progress.',
                })}
              </div>
              <Button onClick={() => void toggleOptOut()} variant="ghost" disabled={savingPref}>
                {stats.leaderboard_opt_out
                  ? t('stats.rejoin_boards', { defaultValue: 'Show me on leaderboards' })
                  : t('stats.hide_from_boards', { defaultValue: 'Hide me from leaderboards' })}
              </Button>
            </div>
          </Card>
        )}

        {error && stats && (
          <div role="alert" style={{ fontSize: 13, color: tokens.danger }}>
            {error}
          </div>
        )}
      </div>
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: tokens.text }}>{value}</span>
    </div>
  )
}

function BoardRow({ entry }: { entry: LeaderboardEntry }) {
  const { tokens } = useTheme()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 44,
        padding: '4px 8px',
        borderRadius: 8,
        // The caller's own row is highlighted from the server's `is_self`, not
        // from a client-side id comparison — the board carries no account ids.
        background: entry.is_self ? tokens.primarySoft : 'transparent',
      }}
    >
      <span style={{ minWidth: 36, fontWeight: 800, color: tokens.textMuted, fontSize: 14 }}>
        #{entry.rank}
      </span>
      <span style={{ flex: 1, fontWeight: entry.is_self ? 800 : 600, color: tokens.text, fontSize: 15 }}>
        {entry.screen_name}
      </span>
      <span style={{ fontWeight: 700, color: tokens.text, fontSize: 15 }}>{entry.xp}</span>
    </div>
  )
}
