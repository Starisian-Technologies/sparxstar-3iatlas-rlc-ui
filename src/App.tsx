import { useState } from 'react'
import { JoinScreen } from '@/screens/student/JoinScreen'
import { SetupScreen } from '@/screens/teacher/SetupScreen'
import { MonitorScreen } from '@/screens/teacher/MonitorScreen'
import { RwcCollectionScreen } from '@/screens/student/RwcCollectionScreen'
import { RscCollectionScreen } from '@/screens/student/RscCollectionScreen'
import { QcScreen } from '@/screens/qc/QcScreen'
import { QcTeacherScreen } from '@/screens/teacher/QcTeacherScreen'
import { CeremonyScreen } from '@/screens/ceremony/CeremonyScreen'
import { api } from '@/api/client'
import type { AppState, CollectionMode, CollectionDepth } from '@/types'

type Screen =
  | 'landing'
  | 'teacher_setup'
  | 'teacher_monitor'
  | 'student_join'
  | 'student_rwc_collection'
  | 'student_rsc_collection'
  | 'qc'
  | 'ceremony'

export function App() {
  const [screen, setScreen] = useState<Screen>('landing')
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
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#1B3A6B', padding: 24, gap: 20,
      }}>
        <div style={{ textAlign: 'center', color: '#ffffff' }}>
          <div style={{ fontSize: 36, fontWeight: 700 }}>3iAtlas</div>
          <div style={{ fontSize: 16, opacity: 0.8, marginTop: 4 }}>Rapid Language Collection</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
          <button
            type="button"
            onClick={() => { setState(s => ({ ...s, role: 'student' })); setScreen('student_join') }}
            style={{
              minHeight: 56, fontSize: 18, fontWeight: 700,
              background: '#ffffff', color: '#1B3A6B',
              border: 'none', borderRadius: 12, cursor: 'pointer',
            }}
          >
            Join a session
          </button>

          <button
            type="button"
            onClick={() => { setState(s => ({ ...s, role: 'teacher' })); setScreen('teacher_setup') }}
            style={{
              minHeight: 56, fontSize: 18, fontWeight: 700,
              background: 'rgba(255,255,255,0.15)', color: '#ffffff',
              border: '2px solid rgba(255,255,255,0.4)', borderRadius: 12, cursor: 'pointer',
            }}
          >
            Start a session (teacher)
          </button>
        </div>
      </div>
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
          setScreen(result.mode === 'rwc' ? 'student_rwc_collection' : 'student_rsc_collection')
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
        onSubmitted={() => {
          // Stay on collection screen — student keeps submitting until timer ends
        }}
        onCollectionEnded={() => setScreen('qc')}
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
        onCollectionCompleted={() => {
          // Student has submitted all 12 domains and now waits.
        }}
        onCollectionEnded={() => setScreen('qc')}
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
          onGoCeremony={() => setScreen('ceremony')}
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
          onGoCeremony={() => setScreen('ceremony')}
        />
      )
    }
  }

  // ── Ceremony ────────────────────────────────────────────────────────────────
  if (screen === 'ceremony' && state.session_id) {
    return (
      <CeremonyScreen
        session_id={state.session_id}
        onPlayAgain={() => {
          setState({
            role: 'none',
            session_id: null,
            participant_id: null,
            join_code: null,
            display_name: null,
            mode: null,
            collection_depth: null,
            language: null,
          })
          setScreen('landing')
        }}
      />
    )
  }

  return null
}
