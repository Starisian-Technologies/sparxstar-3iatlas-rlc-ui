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
 * ADULT BOARDS ONLY. Leaderboards are approved for adult users (owner ruling,
 * 2026-09-06); the engine excludes minor tiers from every board response by a
 * server-side tier rule. This screen does not implement that — and must not try
 * to, because a client-side filter is a filter an attacker skips. It renders
 * whatever rows the server returns, which for a minor is an empty board and a
 * null `rank`, while their own XP, accuracy and stars still show.
 *
 * Mobile-first, per the platform's Africa-first constraints: it renders at
 * 360px and every control clears 44px. Self-stats returns BOTH windows in one
 * response, so switching weekly/all-time costs no request for the personal
 * numbers. The board is a second request that cannot be merged into the first:
 * it is scoped to the player's band, and the band is only known once self-stats
 * has answered. Two round trips on open, one per period change after that.
 *
 * Both of those board requests are asynchronous and the player can change period
 * while one is in flight. Every board response is therefore stamped with the
 * generation that asked for it and dropped if that generation is no longer the
 * live one — otherwise a slow weekly page could append itself to, or overwrite,
 * an all-time board the player is already looking at.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
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
  /**
   * FULL-SCREEN LOADING IS FOR THE FIRST VISIT ONLY.
   *
   * It used to be set on every run of the effect below, including a period
   * change — which unmounted this entire screen, radio group and all. Two costs,
   * and the second is the serious one: the learner's own numbers blanked out
   * even though switching period does not refetch them (both windows arrive in
   * one response), and a keyboard user pressing an arrow key had the button
   * they were standing on destroyed under them, dropping focus to the document.
   * A radio group whose arrow keys lose your place is worse than one with no
   * arrow keys at all.
   *
   * Now only the board reloads, and it says so in place.
   */
  const [boardLoading, setBoardLoading] = useState(false)
  const hasLoadedOnce = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [savingPref, setSavingPref] = useState(false)

  // Identifies the board currently on screen. The primary effect bumps it on
  // every (account, window) change; any board request captures it at the moment
  // it is issued and applies its response only if it is still the live one.
  const boardGeneration = useRef(0)
  // Bumped to ask the primary effect to reload the board that is actually on
  // screen, when something outside it (an opt-out) has invalidated those rows.
  const [reloadNonce, setReloadNonce] = useState(0)

  /**
   * Roving tabindex for the period selector.
   *
   * This group announces itself as a `radiogroup`, so assistive technology
   * promises its users the radio-group contract: ONE tab stop, arrows to move
   * and select, Home/End to jump. It shipped with the role and none of the
   * behaviour, which is worse than plain buttons — a screen reader tells the
   * learner to use arrow keys and nothing happens.
   *
   * The same pattern is implemented in `RightsConfirmation`'s `TriQuestion`;
   * this mirrors it deliberately rather than inventing a second interaction.
   */
  const WINDOWS: readonly StatsWindow[] = ['weekly', 'all_time']
  const windowRefs = useRef<Array<HTMLButtonElement | null>>([])

  function onWindowKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const currentIndex = WINDOWS.indexOf(window_)
    let nextIndex: number | null = null

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % WINDOWS.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + WINDOWS.length) % WINDOWS.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = WINDOWS.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    setWindow(WINDOWS[nextIndex])
    windowRefs.current[nextIndex]?.focus()
  }

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
    boardGeneration.current += 1
    if (hasLoadedOnce.current) setBoardLoading(true)
    else setLoading(true)
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
        if (!cancelled) {
          setLoading(false)
          setBoardLoading(false)
          hasLoadedOnce.current = true
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [account_id, window_, reloadNonce, loadBoard, t])

  const loadMore = async () => {
    if (!cursor || !stats) return
    const generation = boardGeneration.current
    setLoadingMore(true)
    try {
      const next = await api.stats.leaderboard({
        window: window_,
        band: stats.band,
        limit: PAGE_SIZE,
        cursor,
      })
      // A period change while this was in flight makes these rows the wrong
      // board's. Appending them would interleave weekly and all-time ranks, and
      // the cursor would then page the wrong board — so drop the whole response.
      if (boardGeneration.current !== generation) return
      // Append rather than replace: keyset paging returns each row once, so the
      // accumulated list is the board so far, not a page that replaced another.
      setEntries((prev) => [...prev, ...next.entries])
      setCursor(next.next_cursor)
    } catch {
      if (boardGeneration.current === generation) {
        setError(t('stats.load_more_failed', { defaultValue: 'Could not load more. Please try again.' }))
      }
    } finally {
      setLoadingMore(false)
    }
  }

  const toggleOptOut = async () => {
    if (!stats) return
    const generation = boardGeneration.current
    setSavingPref(true)
    try {
      const result = await api.stats.setLeaderboardOptOut(account_id, !stats.leaderboard_opt_out)
      // The preference itself is not board-scoped, so it applies regardless of
      // which period is now showing; only the refreshed rows below are.
      setStats((prev) => (prev ? { ...prev, leaderboard_opt_out: result.opt_out } : prev))
      const board = await loadBoard(window_, stats.band)
      if (boardGeneration.current !== generation) {
        // The player switched period while this was pending. These rows belong
        // to the old board, but the board now on screen was fetched before the
        // opt-out landed and so still reflects the old preference — reload it
        // rather than leaving the player listed after asking to be hidden.
        setReloadNonce((n) => n + 1)
        return
      }
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
          onKeyDown={onWindowKeyDown}
          style={{ display: 'flex', gap: 4, padding: 4, background: tokens.bg, border: `1px solid ${tokens.border}`, borderRadius: 12 }}
        >
          {WINDOWS.map((w, index) => {
            const selected = window_ === w
            return (
              <button
                key={w}
                ref={(el) => { windowRefs.current[index] = el }}
                type="button"
                role="radio"
                aria-checked={selected}
                // One tab stop for the group: the selected option holds it.
                tabIndex={selected ? 0 : -1}
                onClick={() => setWindow(w)}
                style={{
                  flex: '1 1 0',
                  minHeight: 44,
                  fontSize: 16,
                  fontWeight: 700,
                  background: selected ? tokens.primary : 'transparent',
                  color: selected ? tokens.textInverse : tokens.textMuted,
                  border: 'none',
                  borderRadius: 10,
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
                /* null covers two different situations and the copy has to work
                   for both: an eligible player who has not scored yet, and a
                   minor who is not on a board at all. "Not ranked yet" is true
                   of the first and not misleading to the second — it does not
                   claim a position, and it does not tell a child they were
                   excluded, which is not this screen's news to break. */
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

            {/* Announced in place, so a screen-reader user learns the board is
                being replaced instead of hearing the rows change silently. */}
            {boardLoading && (
              <div role="status" aria-busy="true" style={{ fontSize: 14, color: tokens.textMuted }}>
                {t('stats.board_loading', { defaultValue: 'Loading the board…' })}
              </div>
            )}

            {!boardLoading && entries.length === 0 && (
              <div style={{ fontSize: 14, color: tokens.textMuted }}>
                {t('stats.board_empty', { defaultValue: 'No scores yet. Be the first!' })}
              </div>
            )}

            {entries.map((entry, index) => (
              // Keyed by POSITION, not by (rank, screen_name). Ranks repeat on
              // a tie and screen names are unique only within a school, so that
              // pair can legitimately occur twice on one board — the same
              // non-uniqueness the keyset cursor needed a third component for.
              // Duplicate React keys silently reuse the wrong row.
              <BoardRow key={`${entry.rank}-${entry.screen_name}-${index}`} entry={entry} />
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
