/**
 * useSessionPoll — legacy REST-polling wrapper kept as a thin shim.
 *
 * All screens have been migrated to useSessionSocket (socket.io + 5s poll
 * fallback). This file re-exports useSessionSocket under the old name so any
 * screen that hasn't been updated yet continues to compile and work.
 *
 * Once every consumer is migrated, delete this file and remove all imports.
 */
export { useSessionSocket as useSessionPoll } from '@/hooks/useSessionSocket'
