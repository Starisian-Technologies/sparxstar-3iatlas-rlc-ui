import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
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

function getTeacherToken(): string | null {
  const fromWindow = (window as unknown as Record<string, unknown>)['RLC_TEACHER_TOKEN']
  if (typeof fromWindow === 'string' && fromWindow.length > 0) return fromWindow
  try { return localStorage.getItem('RLC_TEACHER_TOKEN') } catch { return null }
}

interface QcScreenProps {
  session_id: string
  participant_id: string
  mode: CollectionMode
  isTeacher: boolean
  participant_token?: string | null
  onGoCeremony: () => void
}

type QcStep = 'audio' | 'vote' | 'correction' | 'translation'
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
  const { tokens } = useTheme()
  const auth = useMemo(() => {
    if (isTeacher) {
      const t = getTeacherToken()
      return t ? { role: 'teacher' as const, token: t, sessionId: session_id } : null
    }
    return participant_token ? { token: participant_token } : null
  }, [isTeacher, participant_token, session_id])
  const {
    qcWords,
    currentIndex,
    currentToken,
    session,
    loading,
    error,
    setCurrentIndex,
    refreshStatus,
  } = useQcSession(session_id, { auth })
  const { isOnline } = useNetworkStatus()

  const [step, setStep] = useState<QcStep>('audio')
  const [hasVotedByToken, setHasVotedByToken] = useState<Record<string, boolean>>({})
  const [voteCountsByToken, setVoteCountsByToken] = useState<Record<string, VoteCounts>>({})
  const [correction, setCorrection] = useState('')
  const [translation, setTranslation] = useState('')
  const [translationSubmittedByToken, setTranslationSubmittedByToken] = useState<Record<string, boolean>>({})
  const [teacherStarParticipant, setTeacherStarParticipant] = useState('')
  const [teacherStarAssigned, setTeacherStarAssigned] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    setStep('audio')
    setCorrection(currentToken?.text ?? '')
    setTranslation('')
    setActionError(null)
  }, [currentToken?.token_id, currentToken?.text])

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
    return <FullScreenMessage title="Loading review…" subtitle="Preparing words for the community check." tokens={tokens} />
  }

  if (!currentToken) {
    return (
      <FullScreenMessage
        title="Review queue is empty"
        subtitle={error ? 'Could not load words — check your connection.' : 'No words ready for review yet.'}
        tokens={tokens}
      />
    )
  }

  const voteDimension: VotePayload['dimension'] = mode === 'rsc' ? 'semantics' : 'orthography'
  const hasVoted = hasVotedByToken[currentToken.token_id] === true
  const voteCounts = voteCountsByToken[currentToken.token_id] ?? getDefaultCounts(currentToken, voteDimension)
  // QcToken no longer carries submitter_id (anonymized per contract §3.4).
  // The server enforces submitter-only correction at the /token/:id/correct
  // endpoint via the participant token; if a non-submitter tries, they get 403.
  // For the slice, UI shows the correction input to everyone when the vote fails;
  // the failure mode is a server 403 surfaced as actionError.
  const translationSubmitted = translationSubmittedByToken[currentToken.token_id] === true
  const isLastToken = currentIndex === qcWords.length - 1

  const handleVote = async (vote_yes: boolean) => {
    if (hasVoted) return
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
      setHasVotedByToken((prev) => ({ ...prev, [currentToken.token_id]: true }))
      setVoteCountsByToken((prev) => ({ ...prev, [currentToken.token_id]: dimensionCounts }))
      const correctionRequired = dimensionCounts.no > dimensionCounts.yes
      setStep(correctionRequired ? 'correction' : 'translation')
      await refreshStatus()
    } catch {
      setActionError('Could not submit vote. Please try again.')
    }
  }

  const handleCorrection = async () => {
    if (!correction.trim()) return
    setActionError(null)
    try {
      await api.token.correct(currentToken.token_id, correction.trim())
      setStep('translation')
    } catch {
      setActionError('Could not submit correction. Try again.')
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

  const handleNextToken = () => {
    if (isLastToken) return
    setCurrentIndex(currentIndex + 1)
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
            Review {currentIndex + 1} of {qcWords.length}
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
            <StepLabel label="Step 1 — Audio" tokens={tokens} />
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
            <Button onClick={() => setStep('vote')} variant="primary">
              Continue to vote
            </Button>
          </div>
        )}

        {step === 'vote' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StepLabel label="Step 2 — Community vote" tokens={tokens} />
            <div style={{ fontSize: 15, color: tokens.text, fontWeight: 600 }}>
              {mode === 'rsc' ? 'Does this sentence make sense?' : 'Is the spelling correct?'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                aria-label="Vote yes"
                onClick={() => void handleVote(true)}
                disabled={hasVoted}
                style={{
                  flex: 1,
                  minHeight: 56,
                  borderRadius: 12,
                  border: 'none',
                  background: hasVoted ? tokens.card : tokens.success,
                  color: hasVoted ? tokens.textMuted : '#fff',
                  fontSize: 20,
                  fontWeight: 800,
                  cursor: hasVoted ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span aria-hidden="true">✓</span> Yes
              </button>
              <button
                type="button"
                aria-label="Vote no"
                onClick={() => void handleVote(false)}
                disabled={hasVoted}
                style={{
                  flex: 1,
                  minHeight: 56,
                  borderRadius: 12,
                  border: 'none',
                  background: hasVoted ? tokens.card : tokens.danger,
                  color: hasVoted ? tokens.textMuted : '#fff',
                  fontSize: 20,
                  fontWeight: 800,
                  cursor: hasVoted ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span aria-hidden="true">✗</span> No
              </button>
            </div>
            {hasVoted && (
              <div style={{ color: tokens.success, fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
                +5 XP for voting
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
            <StepLabel label="Step 3 — Correction" tokens={tokens} />
            <div style={{ fontSize: 14, color: tokens.textMuted }}>
              The class voted that spelling needs a fix. The word&apos;s author can edit it below.
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
            <StepLabel label="Step 4 — Translation" tokens={tokens} />
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
          {isLastToken ? (
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
            <Button onClick={handleNextToken} variant="primary">
              Next word →
            </Button>
          )}
        </Card>
      )}
    </div>
  )
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
