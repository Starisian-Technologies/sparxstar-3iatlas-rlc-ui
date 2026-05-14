import { QcScreen } from '@/screens/qc/QcScreen'
import type { CollectionMode } from '@/types'

interface QcTeacherScreenProps {
  session_id: string
  participant_id: string
  mode: CollectionMode
  onGoCeremony: () => void
}

export function QcTeacherScreen({
  session_id,
  participant_id,
  mode,
  onGoCeremony,
}: QcTeacherScreenProps) {
  return (
    <QcScreen
      session_id={session_id}
      participant_id={participant_id}
      mode={mode}
      isTeacher
      onGoCeremony={onGoCeremony}
    />
  )
}
