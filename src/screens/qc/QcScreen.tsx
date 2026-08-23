import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, getTeacherToken } from '@/api/client'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { ContinuityBanner } from '@/components/ContinuityBanner'
import { TenantLogo } from '@/components/TenantLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useQcSession } from '@/hooks/useQcSession'
import { emitRuntimeEvent } from '@/runtime/events'
import { useTheme } from '@/theme/useTheme'
import type { CollectionMode, LeaderboardEntry, VotePayload } from '@/types'

interface QcScreenProps {
  session_id: string
  participant_id: string
  mode: CollectionMode
  isTeacher: boolean
  participant_token?: string | null
  onGoCeremony: () => void
}

/**
 * The QC steps, one per vote AXIS plus the two write steps.
 *
 * This used to be `'audio' | 'vote' | 'correction' | 'translation'` — a single
 * merged `vote` step that cast ONE dimension, chosen by mode: orthography for
 * words, semantics for sentences. So in a sentence session nobody ever voted on
 * spelling, and in a word session nobody voted on meaning, and the platform
 * silently lost half its linguistic-confidence evidence.
 *
 * The three axes are independent evidence and are collected independently
 * (spec §5.7). They are NOT equal in consequence: spelling is the only axis that
 * moves the token's workflow state; meaning and pronunciation are recorded and
 * exported as confidence signals and gate nothing. That asymmetry is the
 * server's, and this screen does not re-implement it — it just collects all
 * three and lets the server decide what each one does.
 */
type QcStep = 'audio' | 'spelling' | 'meaning' | 'correction' | 'translation'

/** The vote dimension each voting step casts. */
const STEP_DIMENSION: Record<'audio' | 'spelling' | 'meaning', VotePayload['dimension']> = {
  audio: 'audio',
  spelling: 'orthography',
  meaning: 'semantics'
}
type VoteCounts = { yes: number; no: number }
type QcVoteToken = { vote_orthography: VoteCounts; vote_semantics: VoteCounts; vote_audio?: VoteCounts }

export function QcScreen({
  session_id,
  participant_id,
  mode,
  isTeacher,
  participant_token = null,
  onGoCeremony,
}: QcScreenProps) {
  const { t } = useTranslation()
  const { tokens } = useTheme()
  const auth = useMemo(() => {
    if (isTeacher) {
      const teacherToken = getTeacherToken()
      return teacherToken ? { role: 'teacher' as const, token: teacherToken, sessionId: session_id } : null
    }
    return participant_token ? { token: participant_token } : null
  }, [isTeacher, participant_token, session_id])
  const {
    qcWords,
    currentToken,
    exhausted,
    awaitingTeacher,
    position,
    session,
    loading,
    error,
    hydrate,
    refreshStatus,
  } = useQcSession(session_id, { auth })
  const { isOnline } = useNetworkStatus()

  const [step, setStep] = useState<QcStep>('audio')
  /**
   * Voted state and tallies keyed by `token_id:dimension` — one entry per axis,
   * because one vote on one axis says nothing about the other two.
   */
  const [hasVotedByToken, setHasVotedByToken] = useState<Record<string, boolean>>({})
  const [voteCountsByToken, setVoteCountsByToken] = useState<Record<string, VoteCounts>>({})
  const [correction, setCorrection] = useState('')
  const [translation, setTranslation] = useState('')
  const [translationSubmittedByToken, setTranslationSubmittedByToken] = useState<Record<string, boolean>>({})
  const [teacherStarParticipant, setTeacherStarParticipant] = useState('')
  const [teacherStarAssigned, setTeacherStarAssigned] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  /** Guards the teacher's advance so a double-tap cannot fire two requests. */
  const [advancing, setAdvancing] = useState(false)
  /**
   * Whether the spelling vote failed on this token, remembered across the
   * meaning step so the correction step can be offered after it. Spelling is the
   * only axis that can produce this.
   */
  const [spellingFailed, setSpellingFailed] = useState(false)

  /**
   * Reset the axis sequence when the class moves to a DIFFERENT token.
   *
   * Keyed on `token_id` alone, and that is load-bearing. This effect previously
   * also depended on `text`, `yahura_transcription`, and `vote_audio` — all of
   * which change *within* a token's review: `qc:vote` hands back a fresh
   * `vote_audio` object on every classmate's vote, and a correction changes
   * `text`. So a student halfway through typing a correction had their step reset
   * and their input cleared every time anyone else voted. Token identity is the
   * only thing that should restart the sequence.
   *
   * `tokenRef` carries the values the reset needs without making them triggers.
   */
  const tokenRef = useRef(currentToken)
  tokenRef.current = currentToken
  useEffect(() => {
    const token = tokenRef.current
    // Start at the audio vote only when there is a recording to judge; otherwise
    // spelling is step one, matching the server's own skip rule (spec §5.7).
    // Decided once per token — a transcription arriving mid-review must not yank
    // the class backwards into an audio vote they have moved past.
    //
    // Both signals, not just the transcription: a token can carry audio votes
    // before its transcription lands, and the class should still be asked about
    // pronunciation in that window rather than skipping the axis entirely.
    const recorded =
      token?.yahura_transcription != null ||
      (token?.vote_audio?.yes ?? 0) + (token?.vote_audio?.no ?? 0) > 0
    setStep(recorded ? 'audio' : 'spelling')
    setSpellingFailed(false)
    setCorrection(token?.text ?? '')
    setTranslation('')
    setActionError(null)
  }, [currentToken?.token_id])

  // Wire QcToken doesn't carry participants — leaderboard is the canonical
  // participant list during QC.
  const participants = useMemo(() => {
    const leaderboard = session?.leaderboard ?? []
    return leaderboard.map((entry: LeaderboardEntry) => ({
      participant_id: entry.participant_id,
      display_name: entry.display_name,
    }))
  }, [session?.leaderboard])

  if (loading) {
    return (
      <FullScreenMessage
        title={t('qc.loading', { defaultValue: 'Loading review…' })}
        subtitle={t('qc.loading_subtitle', { defaultValue: 'Preparing words for the community check.' })}
        tokens={tokens}
      />
    )
  }

  if (!currentToken) {
    /**
     * Three genuinely different states, which the old single "queue is empty"
     * message collapsed into one. A student staring at "empty" while the teacher
     * has simply not started yet has no idea whether to wait or to worry.
     */
    if (error) {
      return (
        <FullScreenMessage
          title={t('qc.lost_review_title', { defaultValue: 'Lost the review' })}
          subtitle={t('qc.lost_review_subtitle', {
            defaultValue: 'Could not reach the session — check your connection. This screen will catch up on its own.'
          })}
          tokens={tokens}
        />
      )
    }
    if (exhausted) {
      return (
        <FullScreenMessage
          title={t('qc.review_finished_title', { defaultValue: 'Review finished' })}
          subtitle={t('qc.review_finished_subtitle', { defaultValue: 'Every word has been checked.' })}
          tokens={tokens}
        />
      )
    }
    return (
      <FullScreenMessage
        title={t('qc.waiting_for_teacher_title', { defaultValue: 'Waiting for your teacher' })}
        subtitle={
          awaitingTeacher
            ? t('qc.waiting_for_teacher_subtitle', {
              defaultValue: 'The class reviews each word together. Your teacher starts the first one.'
            })
            : t('qc.empty_subtitle', { defaultValue: 'No words ready for review yet.' })
        }
        tokens={tokens}
      />
    )
  }

  /** The axis the current step is voting on, when the step is a voting step. */
  const voteStep = step === 'audio' || step === 'spelling' || step === 'meaning' ? step : null
  const voteDimension = voteStep ? STEP_DIMENSION[voteStep] : null
  const voteKey = voteDimension ? `${currentToken.token_id}:${voteDimension}` : ''
  const hasVoted = voteKey !== '' && hasVotedByToken[voteKey] === true
  const voteCounts = voteDimension
    ? voteCountsByToken[voteKey] ?? getDefaultCounts(currentToken, voteDimension)
    : { yes: 0, no: 0 }
  /**
   * Whether this token has a recording to judge. The engine skips the audio vote
   * when there is none (spec §5.7 step 1), so the client must not ask a class to
   * rate the pronunciation of a word nobody recorded.
   */
  const hasAudio =
    currentToken.yahura_transcription !== null ||
    (currentToken.vote_audio?.yes ?? 0) + (currentToken.vote_audio?.no ?? 0) > 0
  // QcToken no longer carries submitter_id (anonymized per contract §3.4).
  // The server enforces submitter-only correction at the /token/:id/correct
  // endpoint via the participant token; if a non-submitter tries, they get 403.
  // For the slice, UI shows the correction input to everyone when the vote fails;
  // the failure mode is a server 403 surfaced as actionError.
  const translationSubmitted = translationSubmittedByToken[currentToken.token_id] === true

  const handleVote = async (vote_yes: boolean) => {
    if (hasVoted || !voteDimension) return
    setActionError(null)
    try {
      const response = await api.token.vote(currentToken.token_id, {
        dimension: voteDimension,
        vote_yes,
      })
      emitRuntimeEvent('QC_REVIEWED', {
        sessionId: session_id,
        participantId: participant_id,
        mode,
        screen: 'qc',
        metadata: {
          tokenId: currentToken.token_id,
          dimension: voteDimension,
          voteYes: vote_yes,
        },
      })
      const dimensionCounts = response.vote_counts[voteDimension]
      setHasVotedByToken((prev) => ({ ...prev, [voteKey]: true }))
      setVoteCountsByToken((prev) => ({ ...prev, [voteKey]: dimensionCounts }))

      /**
       * Move to the next step. Only the SPELLING result can branch to
       * correction, and only on a strict majority No — a tie does not trigger it
       * (spec §5.7). Meaning and pronunciation never branch: they are evidence,
       * not gates.
       */
      if (voteDimension === 'orthography') {
        const correctionRequired = dimensionCounts.no > dimensionCounts.yes
        setSpellingFailed(correctionRequired)
        setStep('meaning')
      } else if (voteDimension === 'audio') {
        setStep('spelling')
      } else {
        // Meaning is the last vote. Correction comes after it, if spelling failed.
        setStep(spellingFailed ? 'correction' : 'translation')
      }
      await refreshStatus()
    } catch {
      setActionError(t('qc.error_vote', { defaultValue: 'Could not submit vote. Please try again.' }))
    }
  }

  const handleCorrection = async () => {
    if (!correction.trim()) return
    setActionError(null)
    try {
      await api.token.correct(currentToken.token_id, correction.trim())
      setStep('translation')
    } catch (err) {
      // Server enforces submitter-only correction (contract §3.5). Non-authors
      // get a 403; surface a specific message instead of a generic retry hint.
      // api/client.ts formats errors as "API <status>: <body>"; match the
      // prefix rather than substring-matching '403', which could collide
      // with body text (e.g. a token_id "...403...").
      const msg = err instanceof Error ? err.message : ''
      if (/^API 403\b/.test(msg)) {
        setActionError('Only the author of this word can submit a correction.')
      } else {
        setActionError('Could not submit correction. Try again.')
      }
    }
  }

  const handleTranslation = async () => {
    if (!translation.trim()) return
    setActionError(null)
    try {
      await api.token.submitTranslation(currentToken.token_id, translation.trim())
      setTranslationSubmittedByToken((prev) => ({ ...prev, [currentToken.token_id]: true }))
      await refreshStatus()
    } catch {
      setActionError('Could not submit translation. Try again.')
    }
  }

  /**
   * The teacher's advance. This is the fix for the defect at the centre of this
   * change: the button used to bump a local index, so it moved this browser and
   * nobody else. It now asks the server to advance, and the resulting `qc:token`
   * broadcast moves every connected client — including this one, which learns
   * its new position the same way a student does.
   */
  const handleAdvance = async () => {
    if (advancing) return
    setAdvancing(true)
    setActionError(null)
    try {
      await api.session.qcAdvance(session_id)
      // No local state change here on purpose. The position arrives as an event.
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (/^API 409\b/.test(msg)) {
        // qc_exhausted, or a conflicting advance from another teacher device.
        // Re-read rather than guessing which.
        await hydrate()
      } else {
        setActionError('Could not move the class to the next word. Try again.')
      }
    } finally {
      setAdvancing(false)
    }
  }

  const handleAssignTeacherStar = async () => {
    if (!teacherStarParticipant || teacherStarAssigned) return
    setActionError(null)
    try {
      await api.session.assignTeacherStar(session_id, teacherStarParticipant)
      setTeacherStarAssigned(true)
    } catch {
      setActionError("Could not assign Teacher's Star. Try again.")
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 52,
    borderRadius: 12,
    border: `1.5px solid ${tokens.border}`,
    background: tokens.bg,
    color: tokens.text,
    padding: '12px 14px',
    fontSize: 18,
    boxSizing: 'border-box',
    outline: 'none',
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: tokens.bg,
      color: tokens.text,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: 16,
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <TenantLogo size="medium" />
        <ThemeToggle />
      </div>

      {/* Word hero card */}
      <div style={{
        borderRadius: 16,
        background: `linear-gradient(135deg, ${tokens.primarySoft} 0%, rgba(168,85,247,0.12) 100%)`,
        border: `1px solid ${tokens.border}`,
        padding: '14px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}>
        <div>
          <div style={{ color: tokens.textMuted, fontSize: 11, letterSpacing: 1, fontWeight: 700, textTransform: 'uppercase' }}>
            Review {position} of {qcWords.length}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: tokens.text, marginTop: 2, letterSpacing: -0.5 }}>
            {currentToken.text}
          </div>
          {currentToken.translation && (
            <div style={{ color: tokens.textMuted, fontSize: 14, marginTop: 2 }}>{currentToken.translation}</div>
          )}
        </div>
        <div style={{
          background: tokens.primarySoft,
          border: `1px solid ${tokens.primary}`,
          borderRadius: 10,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 700,
          color: tokens.primary,
          whiteSpace: 'nowrap',
        }}>
          {mode === 'rsc' ? 'Sentence' : 'Word'}
        </div>
      </div>

      <ContinuityBanner isOnline={isOnline} hasConnectionIssue={Boolean(error)} />

      {/* Step panel */}
      <Card>
        {step === 'audio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StepLabel label={t('qc.step_pronunciation', { defaultValue: 'Step 1 — Pronunciation' })} tokens={tokens} />
            <div style={{
              border: `2px dashed ${tokens.border}`,
              borderRadius: 12,
              padding: 28,
              textAlign: 'center',
              color: tokens.textMuted,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              alignItems: 'center',
            }}>
              <svg aria-hidden="true" width={40} height={40} viewBox="0 0 40 40" fill="none">
                <rect x={16} y={6} width={8} height={18} rx={4} fill={tokens.textMuted} />
                <path d="M10 20c0 5.523 4.477 10 10 10s10-4.477 10-10" stroke={tokens.textMuted} strokeWidth={2} strokeLinecap="round" fill="none" />
                <line x1={20} y1={30} x2={20} y2={36} stroke={tokens.textMuted} strokeWidth={2} strokeLinecap="round" />
                <line x1={14} y1={36} x2={26} y2={36} stroke={tokens.textMuted} strokeWidth={2} strokeLinecap="round" />
              </svg>
              <div style={{ fontSize: 14 }}>
                {((currentToken.vote_audio?.yes ?? 0) + (currentToken.vote_audio?.no ?? 0)) > 0
                  ? 'Audio playback (Starmus not yet wired)'
                  : 'No recording for this word'}
              </div>
            </div>
            <div style={{ fontSize: 15, color: tokens.text, fontWeight: 600 }}>
              {t('qc.vote_question_audio', { defaultValue: 'Can you hear the word said properly?' })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                aria-label="Pronunciation yes"
                onClick={() => void handleVote(true)}
                disabled={hasVoted}
                style={voteButtonStyle(tokens.success, hasVoted, tokens)}
              >
                <span aria-hidden="true">✓</span> {t('qc.vote_yes')}
              </button>
              <button
                type="button"
                aria-label="Pronunciation no"
                onClick={() => void handleVote(false)}
                disabled={hasVoted}
                style={voteButtonStyle(tokens.danger, hasVoted, tokens)}
              >
                <span aria-hidden="true">✗</span> {t('qc.vote_no')}
              </button>
            </div>
            {!hasAudio && (
              <Button onClick={() => setStep('spelling')} variant="soft">
                {t('qc.skip_no_recording')}
              </Button>
            )}
          </div>
        )}

        {(step === 'spelling' || step === 'meaning') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StepLabel
              label={step === 'spelling'
                ? t('qc.step_spelling', { defaultValue: 'Step 2 — Spelling' })
                : t('qc.step_meaning', { defaultValue: 'Step 3 — Meaning' })}
              tokens={tokens}
            />
            <div style={{ fontSize: 15, color: tokens.text, fontWeight: 600 }}>
              {step === 'spelling'
                ? t('qc.vote_question_spelling', { defaultValue: 'Is this spelled correctly?' })
                : mode === 'rsc'
                  ? t('qc.vote_question_semantics_rsc', { defaultValue: 'Does this make sense? Is the grammar correct?' })
                  : t('qc.vote_question_semantics_rwc', { defaultValue: 'Does this make sense?' })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                aria-label="Vote yes"
                onClick={() => void handleVote(true)}
                disabled={hasVoted}
                style={voteButtonStyle(tokens.success, hasVoted, tokens)}
              >
                <span aria-hidden="true">✓</span> {t('qc.vote_yes')}
              </button>
              <button
                type="button"
                aria-label="Vote no"
                onClick={() => void handleVote(false)}
                disabled={hasVoted}
                style={voteButtonStyle(tokens.danger, hasVoted, tokens)}
              >
                <span aria-hidden="true">✗</span> {t('qc.vote_no')}
              </button>
            </div>
            {hasVoted && (
              <div style={{ color: tokens.success, fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
                {t('qc.voted_xp')}
              </div>
            )}
            <div style={{
              display: 'flex',
              gap: 16,
              justifyContent: 'center',
              fontSize: 13,
              color: tokens.textMuted,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: tokens.success, fontWeight: 700 }}>✓ {voteCounts.yes}</span>
              <span style={{ color: tokens.danger, fontWeight: 700 }}>✗ {voteCounts.no}</span>
            </div>
          </div>
        )}

        {step === 'correction' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StepLabel label={t('qc.step_correction_new', { defaultValue: 'Step 4 — Correction' })} tokens={tokens} />
            <div style={{ fontSize: 14, color: tokens.textMuted }}>
              {t('qc.correction_prompt_author', {
                defaultValue: 'The class voted that spelling needs a fix. The word\'s author can edit it below.'
              })}
            </div>
            <input
              type="text"
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              style={inputStyle}
              aria-label="Correction input"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <Button onClick={() => void handleCorrection()} disabled={!correction.trim()} variant="primary">
              Submit correction
            </Button>
          </div>
        )}

        {step === 'translation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StepLabel label={t('qc.step_translation_new', { defaultValue: 'Step 5 — Translation' })} tokens={tokens} />
            <input
              type="text"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="Type the English meaning…"
              style={{ ...inputStyle, opacity: translationSubmitted ? 0.5 : 1 }}
              aria-label="Translation input"
              disabled={translationSubmitted}
              autoCapitalize="off"
              spellCheck
            />
            <Button
              onClick={() => void handleTranslation()}
              disabled={!translation.trim() || translationSubmitted}
              variant="primary"
            >
              {translationSubmitted ? 'Waiting for others…' : 'Submit translation'}
            </Button>
            {/* Class translation list is no longer broadcast on the wire (contract §3.4). */}
          </div>
        )}

        {actionError && (
          <div role="alert" style={{
            marginTop: 8,
            background: 'rgba(239,68,68,0.1)',
            border: `1px solid ${tokens.danger}`,
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 14,
            color: tokens.danger,
          }}>
            {actionError}
          </div>
        )}
      </Card>

      {/* Teacher controls */}
      {isTeacher && (
        <Card highlight>
          <div style={{ fontSize: 13, fontWeight: 700, color: tokens.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 }}>
            Teacher controls
          </div>
          {exhausted ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label
                  htmlFor="teacher-star"
                  style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: tokens.textMuted }}
                >
                  Assign Teacher&apos;s Star
                </label>
                <select
                  id="teacher-star"
                  value={teacherStarParticipant}
                  onChange={(e) => setTeacherStarParticipant(e.target.value)}
                  disabled={teacherStarAssigned}
                  style={{
                    width: '100%',
                    minHeight: 48,
                    padding: '0 12px',
                    background: tokens.bg,
                    color: tokens.text,
                    border: `1.5px solid ${tokens.border}`,
                    borderRadius: 12,
                    fontSize: 16,
                    appearance: 'none',
                    opacity: teacherStarAssigned ? 0.5 : 1,
                  }}
                  aria-label="Select participant to award Teacher's Star"
                >
                  <option value="">Select a student…</option>
                  {participants.map((p) => (
                    <option key={p.participant_id} value={p.participant_id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>

                {/* Avatar preview for selected participant */}
                {teacherStarParticipant && !teacherStarAssigned && (() => {
                  const p = participants.find((x) => x.participant_id === teacherStarParticipant)
                  return p ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <Avatar seed={p.display_name} size={36} />
                      <span style={{ fontSize: 14, color: tokens.text }}>{p.display_name}</span>
                    </div>
                  ) : null
                })()}
              </div>

              <Button
                onClick={() => void handleAssignTeacherStar()}
                disabled={!teacherStarParticipant || teacherStarAssigned}
                variant={teacherStarAssigned ? 'ghost' : 'primary'}
              >
                {teacherStarAssigned ? "Teacher's Star assigned ✓" : "Assign Teacher's Star"}
              </Button>

              <Button onClick={onGoCeremony} variant="soft">
                Start ceremony →
              </Button>
            </div>
          ) : (
            <Button onClick={() => void handleAdvance()} variant="primary" disabled={advancing}>
              {advancing ? 'Moving the class…' : 'Next word →'}
            </Button>
          )}
        </Card>
      )}
    </div>
  )
}


/**
 * The yes/no vote button style. Shared because there are now three voting steps
 * (pronunciation, spelling, meaning) and a copy per step is three chances for
 * them to look subtly different. Keeps the 56px minimum touch target.
 */
function voteButtonStyle(
  activeBackground: string,
  voted: boolean,
  tokens: { card: string; textMuted: string }
): React.CSSProperties {
  return {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    border: 'none',
    background: voted ? tokens.card : activeBackground,
    color: voted ? tokens.textMuted : '#fff',
    fontSize: 20,
    fontWeight: 800,
    cursor: voted ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  }
}

function StepLabel({ label, tokens }: { label: string; tokens: { primary: string } }) {
  return (
    <div style={{ fontSize: 16, fontWeight: 800, color: tokens.primary }}>{label}</div>
  )
}

function getDefaultCounts(token: QcVoteToken, dimension: VotePayload['dimension']): VoteCounts {
  if (dimension === 'semantics') return token.vote_semantics
  return token.vote_orthography
}

function FullScreenMessage({
  title,
  subtitle,
  tokens,
}: {
  title: string
  subtitle: string
  tokens: { bg: string; text: string; textMuted: string }
}) {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      background: tokens.bg,
      color: tokens.text,
      textAlign: 'center',
      padding: 24,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 15, color: tokens.textMuted }}>{subtitle}</div>
    </div>
  )
}
