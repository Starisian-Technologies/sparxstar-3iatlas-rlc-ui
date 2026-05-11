import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { useQcSession } from '@/hooks/useQcSession'
import type { CollectionMode, LeaderboardEntry, VotePayload } from '@/types'

interface QcScreenProps {
  session_id: string
  participant_id: string
  mode: CollectionMode
  isTeacher: boolean
  onGoCeremony: () => void
}

type QcStep = 'audio' | 'vote' | 'correction' | 'translation'
type VoteCounts = { yes: number; no: number }
type QcVoteToken = { vote_orthography: VoteCounts; vote_semantics: VoteCounts; vote_audio: VoteCounts }

export function QcScreen({
  session_id,
  participant_id,
  mode,
  isTeacher,
  onGoCeremony,
}: QcScreenProps) {
  const {
    qcWords,
    currentIndex,
    currentToken,
    session,
    loading,
    error,
    setCurrentIndex,
    refreshStatus,
  } = useQcSession(session_id)

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
    setCorrection(currentToken?.corrected_text ?? currentToken?.text ?? '')
    setTranslation('')
    setActionError(null)
  }, [currentToken?.token_id, currentToken?.corrected_text, currentToken?.text])

  const participants = useMemo(() => {
    const fromParticipants = session?.participants ?? []
    if (fromParticipants.length > 0) {
      return fromParticipants.map((participant) => ({
        participant_id: participant.participant_id,
        display_name: participant.display_name,
      }))
    }
    const leaderboard = session?.leaderboard ?? []
    return leaderboard.map((entry: LeaderboardEntry) => ({
      participant_id: entry.participant_id,
      display_name: entry.display_name,
    }))
  }, [session?.leaderboard, session?.participants])

  if (loading) {
    return <FullScreenMessage title="Loading QC..." subtitle="Preparing the review words." />
  }

  if (!currentToken) {
    return (
      <FullScreenMessage
        title="QC queue is empty"
        subtitle={error ? 'Could not load QC words.' : 'No words are ready for review.'}
      />
    )
  }

  const voteDimension: VotePayload['dimension'] = mode === 'rsc' ? 'semantics' : 'orthography'
  const hasVoted = hasVotedByToken[currentToken.token_id] === true
  const voteCounts = voteCountsByToken[currentToken.token_id] ?? getDefaultCounts(currentToken, voteDimension)
  const majorityNo = voteCounts.no > voteCounts.yes
  const isSubmitter = currentToken.submitter_id === participant_id
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
      setHasVotedByToken((prev) => ({ ...prev, [currentToken.token_id]: true }))
      setVoteCountsByToken((prev) => ({ ...prev, [currentToken.token_id]: response.vote_counts }))
      setStep(majorityNo && isSubmitter ? 'correction' : 'translation')
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

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 14, opacity: 0.8 }}>
          QC {currentIndex + 1} of {qcWords.length}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{currentToken.text}</div>
      </div>

      <div style={panelStyle}>
        {step === 'audio' && (
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Step 1 — Audio</h2>
            <div style={placeholderStyle}>
              <div style={{ fontSize: 42 }}>🔊</div>
              <div>
                {(currentToken.vote_audio.yes + currentToken.vote_audio.no) > 0
                  ? 'Playback placeholder (Starmus not wired yet)'
                  : 'No recording'}
              </div>
            </div>
            <button type="button" onClick={() => setStep('vote')} style={primaryButtonStyle(false)}>
              Continue to vote
            </button>
          </section>
        )}

        {step === 'vote' && (
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Step 2 — Community vote</h2>
            <div style={{ fontSize: 16, color: 'var(--text-primary)' }}>
              {mode === 'rsc' ? 'Does this sentence make sense?' : 'Is the spelling correct?'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                aria-label="Vote yes"
                onClick={() => void handleVote(true)}
                disabled={hasVoted}
                style={{ ...primaryButtonStyle(hasVoted), background: hasVoted ? 'rgba(255,255,255,0.15)' : 'var(--success)', flex: 1 }}
              >
                Yes
              </button>
              <button
                type="button"
                aria-label="Vote no"
                onClick={() => void handleVote(false)}
                disabled={hasVoted}
                style={{ ...primaryButtonStyle(hasVoted), background: hasVoted ? 'rgba(255,255,255,0.15)' : 'var(--danger)', flex: 1 }}
              >
                No
              </button>
            </div>
            {hasVoted && <div style={{ color: 'var(--success)', fontSize: 14 }}>+5 XP for voting</div>}
            <div style={voteCountStyle}>Votes — Yes: {voteCounts.yes} · No: {voteCounts.no}</div>
          </section>
        )}

        {step === 'correction' && (
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Step 3 — Correction</h2>
            {isSubmitter ? (
              <>
                <input
                  type="text"
                  value={correction}
                  onChange={(event) => setCorrection(event.target.value)}
                  style={inputStyle}
                  aria-label="Correction input"
                />
                <button
                  type="button"
                  onClick={() => void handleCorrection()}
                  disabled={!correction.trim()}
                  style={primaryButtonStyle(!correction.trim())}
                >
                  Submit correction
                </button>
              </>
            ) : (
              <div style={{ fontSize: 16, color: '#666' }}>Correction in progress...</div>
            )}
          </section>
        )}

        {step === 'translation' && (
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Step 4 — Translation</h2>
            <input
              type="text"
              value={translation}
              onChange={(event) => setTranslation(event.target.value)}
              placeholder="Type translation"
              style={inputStyle}
              aria-label="Translation input"
              disabled={translationSubmitted}
            />
            <button
              type="button"
              onClick={() => void handleTranslation()}
              disabled={!translation.trim() || translationSubmitted}
              style={primaryButtonStyle(!translation.trim() || translationSubmitted)}
            >
              {translationSubmitted ? 'Waiting for others...' : 'Submit translation'}
            </button>
            <div style={{ fontSize: 14, color: '#444' }}>Class translations:</div>
            <div style={translationsFeedStyle}>
              {(currentToken.qc_translations ?? []).map((item, index) => (
                <div key={`${item.participant_id}-${index}`} style={{ fontSize: 14 }}>
                  {item.translation}
                </div>
              ))}
            </div>
          </section>
        )}

        {actionError && <div role="alert" style={errorStyle}>{actionError}</div>}
        {error && <div role="alert" style={errorStyle}>Connection issue — retrying every 2 seconds.</div>}
      </div>

      {isTeacher && (
        <div style={teacherPanelStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Teacher controls</h2>
          {isLastToken ? (
            <>
              <label htmlFor="teacher-star" style={{ fontSize: 14, fontWeight: 600 }}>
                Assign Teacher&apos;s Star
              </label>
              <select
                id="teacher-star"
                value={teacherStarParticipant}
                onChange={(event) => setTeacherStarParticipant(event.target.value)}
                disabled={teacherStarAssigned}
                style={inputStyle}
              >
                <option value="">Select participant</option>
                {participants.map((participant) => (
                  <option key={participant.participant_id} value={participant.participant_id}>
                    {participant.display_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleAssignTeacherStar()}
                disabled={!teacherStarParticipant || teacherStarAssigned}
                style={primaryButtonStyle(!teacherStarParticipant || teacherStarAssigned)}
              >
                {teacherStarAssigned ? 'Teacher’s Star assigned' : 'Assign Teacher’s Star'}
              </button>
              <button type="button" onClick={onGoCeremony} style={primaryButtonStyle(false)}>
                Start ceremony
              </button>
            </>
          ) : (
            <button type="button" onClick={handleNextToken} style={primaryButtonStyle(false)}>
              Next word
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function getDefaultCounts(token: QcVoteToken, dimension: VotePayload['dimension']): VoteCounts {
  if (dimension === 'orthography') return token.vote_orthography
  if (dimension === 'semantics') return token.vote_semantics
  return token.vote_audio
}

function FullScreenMessage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={fullScreenMessageStyle}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{subtitle}</div>
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

const headerStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,45,120,0.2) 0%, rgba(168,85,247,0.12) 100%)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 14,
}

const panelStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18,
  color: 'var(--accent-primary)',
  fontWeight: 700,
}

const placeholderStyle: React.CSSProperties = {
  border: '2px dashed var(--border)',
  borderRadius: 12,
  padding: 24,
  textAlign: 'center',
  color: 'var(--text-secondary)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  alignItems: 'center',
  justifyContent: 'center',
}

const voteCountStyle: React.CSSProperties = {
  fontSize: 15,
  color: 'var(--text-secondary)',
  fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.05)',
  color: 'var(--text-primary)',
  padding: '10px 12px',
  fontSize: 16,
}

const translationsFeedStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.03)',
  padding: 10,
  minHeight: 88,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const errorStyle: React.CSSProperties = {
  background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.4)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  color: '#fecaca',
}

const teacherPanelStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const fullScreenMessageStyle: React.CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: 'var(--bg)',
  textAlign: 'center',
  padding: 16,
}

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  minHeight: 52,
  borderRadius: 10,
  border: 'none',
  background: disabled ? 'rgba(255,255,255,0.15)' : 'var(--accent-primary)',
  color: 'var(--text-primary)',
  fontSize: 16,
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
})
