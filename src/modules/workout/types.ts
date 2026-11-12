import type { Syncable } from '@/domain/types'

export const SET_KINDS = {
  warmup: 'Aquecimento',
  prep: 'Preparatória',
  work: 'Trabalho',
} as const

export type SetKind = keyof typeof SET_KINDS

/** A group of equal sets inside an exercise: "1 preparatória de 4-6", "3 de trabalho de 6-9". */
export interface RoutineBlock {
  kind: SetKind
  sets: number
  /** Free text target: "10", "8-12", "até a falha"; seconds for timed exercises */
  reps: string
  restSeconds: number
}

/** One exercise of a routine, with the blocks planned for it, in order. */
export interface RoutineItem {
  /** Id from the fixed catalog (exercises.ts) */
  exerciseId: string
  blocks: RoutineBlock[]
  notes: string
}

/** A workout plan: "Treino A", "Peito e tríceps"… */
export interface Routine extends Syncable {
  name: string
  notes: string
  items: RoutineItem[]
}

/** One set of a session. Kind, target and rest are copied from the routine when the session starts. */
export interface SetLog {
  kind: SetKind
  target: string
  restSeconds: number
  /** Kilograms, 0 for bodyweight */
  weight: number
  /** Repetitions, or seconds for timed exercises */
  reps: number
  done: boolean
}

export interface SessionExercise {
  exerciseId: string
  notes: string
  sets: SetLog[]
}

/** One day at the gym. It is in progress while `finishedAt` is empty. */
export interface WorkoutSession extends Syncable {
  routineId: string
  /** Copied from the routine, so history survives renaming or deleting it */
  routineName: string
  /** YYYY-MM-DD */
  date: string
  /** ISO timestamps; `finishedAt` is empty while in progress */
  startedAt: string
  finishedAt: string
  exercises: SessionExercise[]
  notes: string
}

export type WorkoutData = {
  routines: Routine[]
  sessions: WorkoutSession[]
}
