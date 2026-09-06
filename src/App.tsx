import { useMemo, useState } from 'react'
import { LandingScreen } from '@/screens/LandingScreen'
import { JoinScreen } from '@/screens/student/JoinScreen'
import { LobbyScreen } from '@/screens/student/LobbyScreen'
import { SetupScreen } from '@/screens/teacher/SetupScreen'
import { TeacherSignedOut } from '@/screens/teacher/TeacherSignedOut'
import { MonitorScreen } from '@/screens/teacher/MonitorScreen'
import { RwcCollectionScreen } from '@/screens/student/RwcCollectionScreen'
import { RscCollectionScreen } from '@/screens/student/RscCollectionScreen'
import { RscCompleteScreen } from '@/screens/student/RscCompleteScreen'
import { QcScreen } from '@/screens/qc/QcScreen'
import { getTeacherToken } from '@/api/client'
import { QcTeacherScreen } from '@/screens/teacher/QcTeacherScreen'
import { CeremonyScreen } from '@/screens/ceremony/CeremonyScreen'
import { StatsScreen } from '@/screens/StatsScreen'
import { api } from '@/api/client'
import { useSubmissionQueue } from '@/hooks/useSubmissionQueue'
import { emitRuntimeEvent } from '@/runtime/events'
import type { AppState, CollectionMode, CollectionDepth, SessionStatus } from '@/types'

function hasTeacherToken(): boolean {
  if (typeof window === 'undefined') return false
  const fromWindow = (window as unknown as Record<string, unknown>)['RLC_TEACHER_TOKEN']
  return typeof fromWindow === 'string' && fromWindow.length > 0
}

const TEACHER_RUNTIME_PARTICIPANT_ID = 'teacher'

type Screen =
  | 'landing'
  | 'teacher_missing_token'
  | 'teacher_setup'
  | 'teacher_monitor'
  | 'student_join'
  | 'student_lobby'
  | 'student_rwc_collection'
  | 'student_rsc_collection'
  | 'student_rsc_complete'
  | 'qc'
  | 'ceremony'
  | 'stats'

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
  const [rscSubmittedCount, setRscSubmittedCount] = useState(0)
  const [state, setState] = useState<AppState>({
    role: 'none',
    session_id: null,
    participant_id: null,
    account_id: null,
    participant_token: null,
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
          // Teacher token must come from the orchestrator (window.RLC_TEACHER_TOKEN).
          // There is no /auth/login endpoint per contract §2.1.
          setScreen(hasTeacherToken() ? 'teacher_setup' : 'teacher_missing_token')
        }}
      />
    )
  }

  // ── Teacher not signed in ─────────────────────────────────────────────────
  //
  // The teacher's credential is an IDENTITY-ISSUED token supplied by the host
  // page in memory (NODE-ADR-007: Identity authenticates, RLC authorizes). It
  // proves who the teacher is and grants nothing; whether they may create a
  // session is resolved server-side against RLC's own authorization records.
  //
  // This copy previously told the teacher to "open this page from the WordPress
  // orchestrator". There is no WordPress orchestrator and none is to be created
  // (owner ruling, 2026-08-23) — it named a component that does not exist, so a
  // teacher who hit this screen was given an instruction they could not follow.
  if (screen === 'teacher_missing_token') {
    return <TeacherSignedOut onBack={() => { setState(s => ({ ...s, role: 'none' })); setScreen('landing') }} />
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
            account_id: result.account_id ?? null,
            participant_token: result.participant_token ?? null,
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

  // ── Stats & competition ────────────────────────────────────────────────────
  // Rendered from engine-computed values only; see StatsScreen's header.
  if (screen === 'stats' && state.account_id) {
    return <StatsScreen account_id={state.account_id} onBack={() => setScreen('student_lobby')} />
  }

  // ── Student lobby ────────────────────────────────────────────────────────────
  if (screen === 'student_lobby' && state.session_id && state.display_name) {
    return (
      <LobbyScreen
        session_id={state.session_id}
        display_name={state.display_name}
        participant_token={state.participant_token}
        // Only offered when the join actually returned an account_id — the
        // Stats surface is owner-scoped on the engine and there is nothing to
        // ask it about without one.
        onViewStats={state.account_id ? () => setScreen('stats') : undefined}
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
        participant_token={state.participant_token}
        collection_depth={state.collection_depth}
        language={state.language}
        display_name={state.display_name ?? 'You'}
        onSubmitted={() => {
          // Stay on collection screen — student keeps submitting until timer ends
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
        participant_token={state.participant_token}
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
          participant_token={state.participant_token}
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
        participant_token={state.participant_token}
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
  participant_token,
  onReturnToSession,
}: {
  session_id: string
  participant_id: string
  role: AppState['role']
  participant_token: string | null
  onReturnToSession: (role: AppState['role']) => void
}) {
  const { cleanupSession } = useSubmissionQueue(session_id, participant_id, { autoFlush: false })

  /**
   * The ceremony needs a socket credential, because the reveal is server-driven
   * (`ceremony:star` / `ceremony:end`). Without it the screen falls back to a
   * REST reconstruction, which is correct but is not the shared moment.
   */
  const auth = useMemo(() => {
    if (role === 'teacher') {
      const t = getTeacherToken()
      return t ? { role: 'teacher' as const, token: t, sessionId: session_id } : null
    }
    return participant_token ? { token: participant_token } : null
  }, [role, participant_token, session_id])

  return (
    <CeremonyScreen
      session_id={session_id}
      auth={auth}
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
