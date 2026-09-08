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
 * EVERY LEARNER IS RANKED, WHATEVER THEIR AGE. An earlier version of this file
 * said boards were adults-only and that the engine excluded minor tiers. That
 * is no longer true and should never have read as a permanent property: the
 * owner ruling of 2026-09-07 is that minors appear on classroom boards by
 * screen name, participation on by default. The engine scopes a board to the
 * caller's own class instead of filtering by age, so a learner sees their class
 * and no learner is listed outside their school.
 *
 * The scoping is the SERVER'S, and this screen must never attempt its own — a
 * client-side filter is a filter an attacker skips. It renders the rows it is
 * given.
 *
 * Mobile-first, per the platform's Africa-first constraints: it renders at
 * 360px and every control clears 44px. NO TEXT ON THIS SCREEN IS BELOW 16px:
 * hierarchy is carried by weight, colour and letter-spacing instead of by
 * shrinking type. The readers are children, often on small phones in poor
 * light, and a 12px caption is the first thing that stops being read. Self-stats returns BOTH windows in one
 * response, so switching weekly/all-time costs no request for the personal
 * numbers. The board is a second request that cannot be merged into the first:
 * it is a separate resource. Both go out AT ONCE: the board used to wait on
 * self-stats because the request carried the learner's `band`, and the band was
 * only known once self-stats had answered. The engine now resolves an absent
 * band to the caller's own, so the client no longer has to know it, and the two
 * requests are independent.
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
import type { TFunction } from 'i18next'
import type {
  AccountStatsResponse,
  LeaderboardEntry,
  RankMovement,
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
  /**
   * The learner's own row and its neighbours, when the server says they are
   * ranked but not on the page we were given.
   *
   * This is what stops the board being a wall a learner is simply not on. It
   * comes from the server for the same reason ranks do: the client cannot see
   * the rows it was not sent, so it cannot work out who is just ahead.
   */
  const [selfContext, setSelfContext] = useState<LeaderboardEntry[] | null>(null)
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

  // Identifies the board currently on screen. The board effect bumps it on
  // every period change; any secondary board request captures it at the moment
  // it is issued and applies its response only if it is still the live one.
  const boardGeneration = useRef(0)

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
    async (w: StatsWindow) => {
      // Scoped to the player's own band so the ranking is against a comparable
      // cohort — the mitigation the leaderboard supersession is conditional on.
      // No `band`: the engine resolves an absent one to the caller's own, which
      // is both the correct cohort and one fewer thing this screen has to know
      // before it can ask.
      return api.stats.leaderboard({ window: w, limit: PAGE_SIZE })
    },
    [],
  )

  /**
   * SELF-STATS: ONCE PER ACCOUNT, NOT ONCE PER PERIOD.
   *
   * The response carries BOTH windows, so switching weekly/all-time needs no
   * request for these numbers — but this used to sit in the same effect as the
   * board, keyed on `window_`, so every period switch refetched them anyway.
   * Two round trips where the design says one, on the 2G links this platform
   * targets. The screen's own docblock claimed the better behaviour; only the
   * dependency array disagreed.
   */
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const mine = await api.stats.self(account_id)
        if (!cancelled) setStats(mine)
      } catch {
        if (!cancelled) {
          setError(t('stats.load_failed', { defaultValue: 'Could not load your stats. Please try again.' }))
          // Cleared here because the board effect below never runs without
          // stats, so nothing else would take the screen out of loading.
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [account_id, t])

  /**
   * THE BOARD, loaded independently of self-stats.
   *
   * It no longer waits for `stats.band`, so this effect and the self-stats one
   * above run concurrently rather than in series.
   */
  useEffect(() => {
    let cancelled = false
    boardGeneration.current += 1
    if (hasLoadedOnce.current) setBoardLoading(true)
    // Clear any error from a previous attempt: leaving it up after a load
    // succeeds tells a learner their stats are broken while they are looking
    // at them.
    setError(null)
    void (async () => {
      try {
        const board = await loadBoard(window_)
        if (cancelled) return
        setEntries(board.entries)
        setCursor(board.next_cursor)
        setSelfContext(board.self_context)
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
  }, [window_, loadBoard, t])

  const loadMore = async () => {
    if (!cursor) return
    const generation = boardGeneration.current
    setLoadingMore(true)
    // Same reason as the board effect: a stale error must not outlive the
    // failure it describes.
    setError(null)
    try {
      const next = await api.stats.leaderboard({
        window: window_,
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
      // Paging forward can reach the learner's own row; once it is on screen
      // the separate context block would be a duplicate.
      setSelfContext(next.self_context)
    } catch {
      if (boardGeneration.current === generation) {
        setError(t('stats.load_more_failed', { defaultValue: 'Could not load more. Please try again.' }))
      }
    } finally {
      setLoadingMore(false)
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
          <div role="alert" style={{ color: tokens.danger, fontSize: 16 }}>{error}</div>
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
            <div style={{ fontSize: 16, fontWeight: 700, color: tokens.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {window_ === 'weekly'
                ? t('stats.board_weekly', { defaultValue: 'This week' })
                : t('stats.board_all_time', { defaultValue: 'All time' })}
            </div>


            {/* Announced in place, so a screen-reader user learns the board is
                being replaced instead of hearing the rows change silently. */}
            {boardLoading && (
              <div role="status" aria-busy="true" style={{ fontSize: 16, color: tokens.textMuted }}>
                {t('stats.board_loading', { defaultValue: 'Loading the board…' })}
              </div>
            )}

            {!boardLoading && entries.length === 0 && (
              <div style={{ fontSize: 16, color: tokens.textMuted }}>
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

            {selfContext && selfContext.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: tokens.textMuted,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  {t('stats.your_position', { defaultValue: 'Where you are' })}
                </div>
                {selfContext.map((entry, index) => (
                  <BoardRow key={`ctx-${entry.rank}-${entry.screen_name}-${index}`} entry={entry} />
                ))}
              </div>
            )}

            {cursor && (
              <Button onClick={() => void loadMore()} variant="ghost" disabled={loadingMore}>
                {loadingMore
                  ? t('stats.loading_more', { defaultValue: 'Loading…' })
                  : t('stats.show_more', { defaultValue: 'Show more' })}
              </Button>
            )}
          </div>
        </Card>

        {error && stats && (
          <div role="alert" style={{ fontSize: 16, color: tokens.danger }}>
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
      <span style={{ fontSize: 16, color: tokens.textMuted, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: tokens.text }}>{value}</span>
    </div>
  )
}

/**
 * Rank movement, said in words as well as shown as a shape.
 *
 * NOT COLOUR ALONE, and not an arrow alone: the glyph is paired with a
 * `title`/`aria-label` that names the direction, so the row means the same
 * thing to a screen reader and to a learner who cannot distinguish the colours.
 *
 * `new` gets no glyph — a learner ranked for the first time has not moved, and
 * an arrow would imply a comparison that does not exist.
 */
function Movement({ movement, t }: { movement: RankMovement; t: TFunction }) {
  const { tokens } = useTheme()
  if (movement === 'new') return null

  const shown: Record<Exclude<RankMovement, 'new'>, { glyph: string; label: string; color: string }> = {
    up: { glyph: '▲', label: t('stats.moved_up', { defaultValue: 'Moved up' }), color: tokens.success },
    down: { glyph: '▼', label: t('stats.moved_down', { defaultValue: 'Moved down' }), color: tokens.textMuted },
    unchanged: {
      glyph: '–',
      label: t('stats.moved_none', { defaultValue: 'No change' }),
      color: tokens.textMuted,
    },
  }
  const { glyph, label, color } = shown[movement]
  return (
    <span aria-label={label} title={label} style={{ fontSize: 16, color, minWidth: 14 }}>
      {glyph}
    </span>
  )
}

function BoardRow({ entry }: { entry: LeaderboardEntry }) {
  const { tokens } = useTheme()
  const { t } = useTranslation()
  // A tie is announced, not left to a sighted reader to spot as a repeated
  // number — a screen reader hears one row at a time and never sees the repeat.
  const rankLabel = entry.tied
    ? t('stats.rank_tied', { defaultValue: 'Joint {{rank}}', rank: entry.rank })
    : t('stats.rank_plain', { defaultValue: 'Rank {{rank}}', rank: entry.rank })
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
        // Highlighting must not rest on background colour alone.
        outline: entry.is_self ? `2px solid ${tokens.primary}` : 'none',
      }}
    >
      <span
        aria-label={rankLabel}
        style={{ minWidth: 44, fontWeight: 800, color: tokens.textMuted, fontSize: 16 }}
      >
        {entry.tied ? '=' : ''}#{entry.rank}
      </span>
      <Movement movement={entry.movement} t={t} />
      <span style={{ flex: 1, fontWeight: entry.is_self ? 800 : 600, color: tokens.text, fontSize: 16 }}>
        {entry.screen_name}
        {entry.is_self && (
          <span style={{ fontSize: 16, fontWeight: 600, color: tokens.textMuted }}>
            {' '}
            {t('stats.you_marker', { defaultValue: '(you)' })}
          </span>
        )}
      </span>
      <span style={{ fontWeight: 700, color: tokens.text, fontSize: 16 }}>{entry.xp}</span>
    </div>
  )
}
