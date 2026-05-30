import { useState } from 'react'
import { LandingScreen } from '@/screens/LandingScreen'
import { JoinScreen } from '@/screens/student/JoinScreen'
import { LobbyScreen } from '@/screens/student/LobbyScreen'
import { RoundCompleteScreen } from '@/screens/student/RoundCompleteScreen'
import { TeacherLoginScreen } from '@/screens/teacher/TeacherLoginScreen'
import { SetupScreen } from '@/screens/teacher/SetupScreen'
import { MonitorScreen } from '@/screens/teacher/MonitorScreen'
import { RwcCollectionScreen } from '@/screens/student/RwcCollectionScreen'
import { RscCollectionScreen } from '@/screens/student/RscCollectionScreen'
import { RscCompleteScreen } from '@/screens/student/RscCompleteScreen'
import { QcScreen } from '@/screens/qc/QcScreen'
import { QcTeacherScreen } from '@/screens/teacher/QcTeacherScreen'
import { CeremonyScreen } from '@/screens/ceremony/CeremonyScreen'
import { api } from '@/api/client'
import { useSubmissionQueue } from '@/hooks/useSubmissionQueue'
import { emitRuntimeEvent } from '@/runtime/events'
import type { AppState, CollectionMode, CollectionDepth, RoundCompleteSummary, SessionStatus } from '@/types'

function hasTeacherToken(): boolean {
  if (typeof window === 'undefined') return false
  const fromWindow = (window as unknown as Record<string, unknown>)['RLC_TEACHER_TOKEN']
  if (typeof fromWindow === 'string' && fromWindow.length > 0) return true
  try {
    const stored = localStorage.getItem('RLC_TEACHER_TOKEN')
    return typeof stored === 'string' && stored.length > 0
  } catch {
    return false
  }
}

const TEACHER_RUNTIME_PARTICIPANT_ID = 'teacher'

type Screen =
  | 'landing'
  | 'teacher_login'
  | 'teacher_setup'
  | 'teacher_monitor'
  | 'student_join'
  | 'student_lobby'
  | 'student_rwc_collection'
  | 'student_rsc_collection'
  | 'student_rsc_complete'
  | 'student_round_complete'
  | 'qc'
  | 'ceremony'

// A student still on a collection screen when the session leaves 'open' is routed
// by the terminal status: 'ceremony'/'archived' skip straight to the ceremony so
// they are never stranded; 'qc'/'closed' enter the QC review flow.
function nextScreenAfterCollection(status: SessionStatus): Screen {
  if (status === 'open') {
    throw new Error('nextScreenAfterCollection called with non-terminal session status')
  }

  return status === 'ceremony' || status === 'archived' ? 'ceremony' : 'qc'
}

export function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [roundSummary, setRoundSummary] = useState<RoundCompleteSummary | null>(null)
  const [rscSubmittedCount, setRscSubmittedCount] = useState(0)
  const [state, setState] = useState<AppState>({
    role: 'none',
    session_id: null,
    participant_id: null,
    join_code: null,
    display_name: null,
    mode: null,
    collection_depth: null,
    language: null,
  })
  // ── Landing ────────────────────────────────────────────────────────────────
  if (screen === 'landing') {
    return (
      <LandingScreen
        onJoin={() => { setState(s => ({ ...s, role: 'student' })); setScreen('student_join') }}
        onTeacher={() => {
          setState(s => ({ ...s, role: 'teacher' }))
          // Skip login if a token already exists (orchestrator-injected or prior session).
          setScreen(hasTeacherToken() ? 'teacher_setup' : 'teacher_login')
        }}
      />
    )
  }

  // ── Teacher login ──────────────────────────────────────────────────────────
  if (screen === 'teacher_login') {
    return (
      <TeacherLoginScreen
        onLoggedIn={() => setScreen('teacher_setup')}
        onBack={() => { setState(s => ({ ...s, role: 'none' })); setScreen('landing') }}
      />
    )
  }

  // ── Teacher setup ──────────────────────────────────────────────────────────
  if (screen === 'teacher_setup') {
    return (
      <SetupScreen
        onCreated={(result) => {
          setState(s => ({
            ...s,
            session_id: result.session_id,
            join_code: result.join_code,
            mode: result.mode,
            collection_depth: result.collection_depth,
            language: result.language,
          }))
          emitRuntimeEvent('SESSION_JOINED', {
            sessionId: result.session_id,
            participantId: state.participant_id ?? TEACHER_RUNTIME_PARTICIPANT_ID,
            mode: result.mode,
            screen: 'teacher_monitor',
            metadata: {
              joinCode: result.join_code,
              origin: 'session_created',
            },
          })
          setScreen('teacher_monitor')
        }}
      />
    )
  }

  // ── Teacher monitor ────────────────────────────────────────────────────────
  if (screen === 'teacher_monitor' && state.session_id && state.join_code) {
    return (
      <MonitorScreen
        session_id={state.session_id}
        join_code={state.join_code}
        onEndCollection={async () => {
          if (!state.session_id) return
          await api.session.close(state.session_id)
          setScreen('qc')
        }}
      />
    )
  }

  // ── Student join ───────────────────────────────────────────────────────────
  if (screen === 'student_join') {
    return (
      <JoinScreen
        onJoined={(result) => {
          setState(s => ({
            ...s,
            session_id: result.session_id,
            participant_id: result.participant_id,
            display_name: result.display_name,
            mode: result.mode as CollectionMode,
            collection_depth: result.collection_depth as CollectionDepth,
            language: result.language,
          }))
          emitRuntimeEvent('SESSION_JOINED', {
            sessionId: result.session_id,
            participantId: result.participant_id,
            mode: result.mode,
            screen: 'student_lobby',
            metadata: {
              displayName: result.display_name ?? null,
            },
          })
          setScreen('student_lobby')
        }}
      />
    )
  }

  // ── Student lobby ────────────────────────────────────────────────────────────
  if (screen === 'student_lobby' && state.session_id && state.display_name) {
    return (
      <LobbyScreen
        session_id={state.session_id}
        display_name={state.display_name}
        onEnterRound={() => {
          const nextScreen = state.mode === 'rsc' ? 'student_rsc_collection' : 'student_rwc_collection'
          emitRuntimeEvent('ROUND_STARTED', {
            sessionId: state.session_id,
            participantId: state.participant_id,
            mode: state.mode,
            screen: nextScreen,
          })
          setScreen(nextScreen)
        }}
      />
    )
  }

  // ── Student RWC collection ─────────────────────────────────────────────────
  if (
    screen === 'student_rwc_collection' &&
    state.session_id && state.participant_id &&
    state.collection_depth && state.language
  ) {
    return (
      <RwcCollectionScreen
        session_id={state.session_id}
        participant_id={state.participant_id}
        collection_depth={state.collection_depth}
        language={state.language}
        display_name={state.display_name ?? 'You'}
        onSubmitted={() => {
          // Stay on collection screen — student keeps submitting until timer ends
        }}
        onRoundComplete={(summary) => {
          setRoundSummary(summary)
          setScreen('student_round_complete')
        }}
        onClose={() => setScreen('student_lobby')}
        onCollectionEnded={(status) => setScreen(nextScreenAfterCollection(status))}
      />
    )
  }

  // ── Student RSC collection ─────────────────────────────────────────────────
  if (
    screen === 'student_rsc_collection' &&
    state.session_id && state.participant_id &&
    state.collection_depth && state.language
  ) {
    return (
      <RscCollectionScreen
        session_id={state.session_id}
        participant_id={state.participant_id}
        collection_depth={state.collection_depth}
        language={state.language}
        onSubmitted={() => {
          // Stay on collection screen until all 12 domains are complete.
        }}
        onCollectionCompleted={(submittedCount) => {
          setRscSubmittedCount(submittedCount)
          setScreen('student_rsc_complete')
        }}
        onCollectionEnded={(status) => setScreen(nextScreenAfterCollection(status))}
      />
    )
  }

  if (screen === 'student_rsc_complete' && state.session_id) {
    return (
      <RscCompleteScreen
        session_id={state.session_id}
        submittedCount={rscSubmittedCount}
        onCollectionEnded={(status) => setScreen(nextScreenAfterCollection(status))}
      />
    )
  }

  // ── Student round complete ───────────────────────────────────────────────────
  if (screen === 'student_round_complete' && roundSummary) {
    return (
      <RoundCompleteScreen
        summary={roundSummary}
        onNextRound={() => {
          const nextScreen = state.mode === 'rsc' ? 'student_rsc_collection' : 'student_rwc_collection'
          emitRuntimeEvent('ROUND_STARTED', {
            sessionId: state.session_id,
            participantId: state.participant_id,
            mode: state.mode,
            screen: nextScreen,
            metadata: {
              source: 'round_complete',
            },
          })
          setScreen(nextScreen)
        }}
        onBackToLobby={() => setScreen('student_lobby')}
      />
    )
  }

  // ── QC phase ────────────────────────────────────────────────────────────────
  if (screen === 'qc' && state.session_id) {
    if (state.role === 'teacher') {
      return (
        <QcTeacherScreen
          session_id={state.session_id}
          participant_id={state.participant_id ?? 'teacher'}
          mode={state.mode ?? 'rwc'}
          onGoCeremony={() => {
            emitRuntimeEvent('CEREMONY_ENTERED', {
              sessionId: state.session_id,
              participantId: state.participant_id ?? TEACHER_RUNTIME_PARTICIPANT_ID,
              mode: state.mode,
              screen: 'ceremony',
            })
            setScreen('ceremony')
          }}
        />
      )
    }
    if (state.participant_id && state.mode) {
      return (
        <QcScreen
          session_id={state.session_id}
          participant_id={state.participant_id}
          mode={state.mode}
          isTeacher={false}
          onGoCeremony={() => {
            emitRuntimeEvent('CEREMONY_ENTERED', {
              sessionId: state.session_id,
              participantId: state.participant_id,
              mode: state.mode,
              screen: 'ceremony',
            })
            setScreen('ceremony')
          }}
        />
      )
    }
  }

  if (screen === 'ceremony' && state.session_id) {
    return (
      <CeremonyRoute
        session_id={state.session_id}
        participant_id={state.participant_id ?? TEACHER_RUNTIME_PARTICIPANT_ID}
        role={state.role}
        onReturnToSession={(role) => setScreen(role === 'teacher' ? 'teacher_monitor' : 'student_lobby')}
      />
    )
  }

  return null
}

function CeremonyRoute({
  session_id,
  participant_id,
  role,
  onReturnToSession,
}: {
  session_id: string
  participant_id: string
  role: AppState['role']
  onReturnToSession: (role: AppState['role']) => void
}) {
  const { cleanupSession } = useSubmissionQueue(session_id, participant_id, { autoFlush: false })

  return (
    <CeremonyScreen
      session_id={session_id}
      onReturnToSession={async () => {
        try {
          await cleanupSession()
        } catch (error) {
          console.error(
            `Failed to clean up synced records for session ${session_id}. Offline data may persist until manual cleanup or app restart.`,
            error,
          )
        }
        onReturnToSession(role)
      }}
    />
  )
}
