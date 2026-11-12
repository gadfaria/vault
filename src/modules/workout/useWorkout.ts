import { useCallback, useMemo } from 'react'
import { newSyncable, touch } from '@/domain/merge'
import type { Syncable } from '@/domain/types'
import { today } from '@/lib/format'
import { useCollection } from '@/storage/useCollection'
import { buildSessionExercises } from './logic'
import type { Routine, WorkoutData, WorkoutSession } from './types'

const EMPTY: WorkoutData = { routines: [], sessions: [] }

export type RoutineInput = Omit<Routine, keyof Syncable>

export function useWorkout() {
  const { data, loading, save } = useCollection('workout', EMPTY)

  const routines = useMemo(
    () => (data?.routines ?? []).filter((r) => !r.deleted).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [data],
  )

  /** Newest first */
  const sessions = useMemo(
    () => (data?.sessions ?? []).filter((s) => !s.deleted).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [data],
  )

  /** The session in progress, if any */
  const active = useMemo(() => sessions.find((s) => !s.finishedAt), [sessions])

  const saveRoutine = useCallback(
    (input: RoutineInput, existing?: Routine) =>
      save({ routines: [existing ? touch(existing, input) : { ...newSyncable(), ...input }] }),
    [save],
  )

  const deleteRoutine = useCallback((routine: Routine) => save({ routines: [touch(routine, { deleted: true })] }), [save])

  /** Starts a session from a routine, pre-filled with the last loads. Returns it, or null when saving failed. */
  const startSession = useCallback(
    async (routine: Routine): Promise<WorkoutSession | null> => {
      const base = newSyncable()
      const session: WorkoutSession = {
        ...base,
        routineId: routine.id,
        routineName: routine.name,
        date: today(),
        startedAt: base.createdAt,
        finishedAt: '',
        exercises: buildSessionExercises(routine, sessions),
        notes: '',
      }
      return (await save({ sessions: [session] })) ? session : null
    },
    [save, sessions],
  )

  const saveSession = useCallback((session: WorkoutSession) => save({ sessions: [touch(session)] }), [save])

  const deleteSession = useCallback(
    (session: WorkoutSession) => save({ sessions: [touch(session, { deleted: true })] }),
    [save],
  )

  return { loading, routines, sessions, active, saveRoutine, deleteRoutine, startSession, saveSession, deleteSession }
}

export type Workout = ReturnType<typeof useWorkout>
