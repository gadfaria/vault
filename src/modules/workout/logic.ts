import { addDays, parseDate, toIsoDate } from '@/lib/format'
import type { Routine, SessionExercise, SetLog, WorkoutSession } from './types'

/** 42.5 → "42,5 kg"; 0 → "Peso do corpo" */
export function formatWeight(kg: number): string {
  return kg > 0 ? `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg` : 'Peso do corpo'
}

/** Reads "42,5", "42.5" or "42 kg" as kilograms. Returns null when unreadable or negative. */
export function parseWeight(input: string): number | null {
  const cleaned = input.replace(',', '.').replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/** One set in a line: "42,5 kg × 10", just "10" for bodyweight, "60s" for timed exercises. */
export function formatSet(set: { weight: number; reps: number }, unit?: 'seconds'): string {
  const amount = unit === 'seconds' ? `${set.reps}s` : String(set.reps)
  return set.weight > 0 ? `${formatWeight(set.weight)} × ${amount}` : amount
}

/** 3725 → "1h 02min"; 540 → "9min" */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes}min`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}min`
}

/** 75 → "1:15" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function doneSets(exercise: SessionExercise): SetLog[] {
  return exercise.sets.filter((set) => set.done)
}

/** Seconds from start to finish, null while in progress. */
export function sessionSeconds(session: WorkoutSession): number | null {
  if (!session.finishedAt) return null
  return (new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 1000
}

/** Total kilograms moved: weight × reps over the sets marked done. */
export function sessionVolume(session: WorkoutSession): number {
  return session.exercises.flatMap(doneSets).reduce((sum, set) => sum + set.weight * set.reps, 0)
}

export function sessionSetCount(session: WorkoutSession): number {
  return session.exercises.reduce((sum, exercise) => sum + doneSets(exercise).length, 0)
}

/**
 * The sets done the last time this exercise was trained, looking only at finished
 * sessions (newest first by date, then start time), optionally before a given session.
 */
export function lastPerformance(sessions: WorkoutSession[], exerciseId: string, before?: WorkoutSession): SetLog[] {
  const candidates = sessions
    .filter((s) => s.finishedAt && s.id !== before?.id && (!before || s.startedAt < before.startedAt))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  for (const session of candidates) {
    const sets = session.exercises.filter((e) => e.exerciseId === exerciseId).flatMap(doneSets)
    if (sets.length) return sets
  }
  return []
}

/** First number in a reps target: "8-12" → 8, "até a falha" → 0. */
export function targetReps(reps: string): number {
  const match = /\d+/.exec(reps)
  return match ? Number(match[0]) : 0
}

/**
 * The exercises of a new session: one set per planned set, pre-filled with what was done
 * last time in sets of the same kind (the last one repeats when the routine now asks for more).
 */
export function buildSessionExercises(routine: Routine, sessions: WorkoutSession[]): SessionExercise[] {
  return routine.items.map((item) => {
    const previous = lastPerformance(sessions, item.exerciseId)
    const sets = item.blocks.flatMap((block) => {
      const sameKind = previous.filter((set) => set.kind === block.kind)
      return Array.from({ length: Math.max(1, block.sets) }, (_, i): SetLog => {
        const reference = sameKind[Math.min(i, sameKind.length - 1)]
        return {
          kind: block.kind,
          target: block.reps,
          restSeconds: block.restSeconds,
          weight: reference?.weight ?? 0,
          // Without history the field stays empty and shows the target as a hint.
          reps: reference?.reps ?? 0,
          done: false,
        }
      })
    })
    return { exerciseId: item.exerciseId, notes: item.notes, sets }
  })
}

/** "1 × 4-6 · 3 × 6-9": the blocks of an exercise in one line ("3 × 60s" for timed exercises). */
export function summarizeBlocks(blocks: { sets: number; reps: string }[], unit?: 'seconds'): string {
  const suffix = unit === 'seconds' ? 's' : ''
  return blocks.map((block) => `${block.sets} × ${block.reps ? block.reps + suffix : '—'}`).join(' · ')
}

/** The sets that count for records and charts: the work sets, or all of them when none is marked as work. */
export function countedSets(sets: SetLog[]): SetLog[] {
  const work = sets.filter((set) => set.kind === 'work')
  return work.length ? work : sets
}

export interface ProgressPoint {
  /** YYYY-MM-DD */
  date: string
  /** Heaviest set of the day, in kg */
  topWeight: number
  /** Reps of that heaviest set */
  topReps: number
  /** weight × reps over the counted sets of the day */
  volume: number
  sets: SetLog[]
}

/** One point per day the exercise was trained, oldest first. */
export function progressSeries(sessions: WorkoutSession[], exerciseId: string): ProgressPoint[] {
  const byDate = new Map<string, SetLog[]>()
  for (const session of sessions) {
    if (!session.finishedAt) continue
    const sets = countedSets(session.exercises.filter((e) => e.exerciseId === exerciseId).flatMap(doneSets))
    if (sets.length) byDate.set(session.date, [...(byDate.get(session.date) ?? []), ...sets])
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sets]) => {
      const top = sets.reduce((best, set) =>
        set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps) ? set : best,
      )
      return {
        date,
        topWeight: top.weight,
        topReps: top.reps,
        volume: sets.reduce((sum, set) => sum + set.weight * set.reps, 0),
        sets,
      }
    })
}

/** Monday of the week `isoDate` falls in. */
export function weekStart(isoDate: string): string {
  const weekday = parseDate(isoDate).getDay()
  return addDays(isoDate, -((weekday + 6) % 7))
}

/** Finished sessions from the Monday of `todayIso`'s week on. */
export function sessionsThisWeek(sessions: WorkoutSession[], todayIso = toIsoDate(new Date())): number {
  const start = weekStart(todayIso)
  return sessions.filter((s) => s.finishedAt && s.date >= start).length
}
