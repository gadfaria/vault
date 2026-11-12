import { describe, expect, it } from 'vitest'
import {
  buildSessionExercises,
  formatClock,
  formatDuration,
  formatSet,
  lastPerformance,
  parseWeight,
  progressSeries,
  sessionsThisWeek,
  sessionVolume,
  summarizeBlocks,
  targetReps,
  weekStart,
} from './logic'
import type { Routine, SetKind, SetLog, WorkoutSession } from './types'

const base = { createdAt: '', updatedAt: '', deleted: false }

function session(id: string, date: string, sets: SetLog[], finished = true, exerciseId = 'bench'): WorkoutSession {
  return {
    ...base,
    id,
    routineId: 'r1',
    routineName: 'Treino A',
    date,
    startedAt: `${date}T10:00:00.000Z`,
    finishedAt: finished ? `${date}T11:00:00.000Z` : '',
    exercises: [{ exerciseId, notes: '', sets }],
    notes: '',
  }
}

const set = (weight: number, reps: number, done = true, kind: SetKind = 'work', target = '10', restSeconds = 60): SetLog => ({
  kind,
  target,
  restSeconds,
  weight,
  reps,
  done,
})

describe('parseWeight', () => {
  it.each([
    ['42,5', 42.5],
    ['42.5', 42.5],
    ['40 kg', 40],
    ['0', 0],
  ])('reads %s as %d kg', (input, kg) => {
    expect(parseWeight(input)).toBe(kg)
  })

  it('returns null when there is no number', () => {
    expect(parseWeight('')).toBeNull()
    expect(parseWeight('abc')).toBeNull()
  })
})

describe('formatting', () => {
  it('formats durations and clocks', () => {
    expect(formatDuration(540)).toBe('9min')
    expect(formatDuration(3725)).toBe('1h 02min')
    expect(formatClock(75)).toBe('1:15')
    expect(formatClock(-3)).toBe('0:00')
  })

  it('formats a set with or without load, and timed ones in seconds', () => {
    expect(formatSet({ weight: 42.5, reps: 10 })).toBe('42,5 kg × 10')
    expect(formatSet({ weight: 0, reps: 12 })).toBe('12')
    expect(formatSet({ weight: 0, reps: 60 }, 'seconds')).toBe('60s')
  })
})

describe('lastPerformance', () => {
  const sessions = [
    session('a', '2026-11-02', [set(40, 10), set(40, 8)]),
    session('b', '2026-11-09', [set(42.5, 10), set(42.5, 9, false)]),
    session('c', '2026-11-11', [set(50, 5)], false),
  ]

  it('takes the done sets of the newest finished session', () => {
    expect(lastPerformance(sessions, 'bench')).toEqual([set(42.5, 10)])
  })

  it('looks only before the given session', () => {
    expect(lastPerformance(sessions, 'bench', sessions[1])).toEqual([set(40, 10), set(40, 8)])
  })

  it('is empty for an exercise never trained', () => {
    expect(lastPerformance(sessions, 'squat')).toEqual([])
  })
})

describe('buildSessionExercises', () => {
  const routine: Routine = {
    ...base,
    id: 'r1',
    name: 'Treino A',
    notes: '',
    items: [
      {
        exerciseId: 'bench',
        notes: '',
        blocks: [
          { kind: 'prep', sets: 1, reps: '4-6', restSeconds: 60 },
          { kind: 'work', sets: 3, reps: '8-12', restSeconds: 120 },
        ],
      },
      { exerciseId: 'squat', notes: '', blocks: [{ kind: 'work', sets: 2, reps: 'até a falha', restSeconds: 90 }] },
    ],
  }

  it('pre-fills each kind from the last time, repeating the last set', () => {
    const history = [session('a', '2026-11-02', [set(20, 5, true, 'prep'), set(40, 10), set(37.5, 8)])]
    const [bench, squat] = buildSessionExercises(routine, history)
    expect(bench.sets).toEqual([
      set(20, 5, false, 'prep', '4-6', 60),
      set(40, 10, false, 'work', '8-12', 120),
      set(37.5, 8, false, 'work', '8-12', 120),
      set(37.5, 8, false, 'work', '8-12', 120),
    ])
    expect(squat.sets).toEqual([set(0, 0, false, 'work', 'até a falha', 90), set(0, 0, false, 'work', 'até a falha', 90)])
  })

  it('leaves load and reps empty without history', () => {
    const [bench] = buildSessionExercises(routine, [])
    expect(bench.sets.map((s) => [s.kind, s.weight, s.reps])).toEqual([
      ['prep', 0, 0],
      ['work', 0, 0],
      ['work', 0, 0],
      ['work', 0, 0],
    ])
  })

  it('reads the first number of a target', () => {
    expect(targetReps('8-12')).toBe(8)
    expect(targetReps('até a falha')).toBe(0)
  })

  it('summarizes blocks in one line', () => {
    expect(summarizeBlocks(routine.items[0].blocks)).toBe('1 × 4-6 · 3 × 8-12')
    expect(summarizeBlocks([{ sets: 3, reps: '60' }], 'seconds')).toBe('3 × 60s')
  })
})

describe('progress', () => {
  const sessions = [
    session('b', '2026-11-09', [set(42.5, 10), set(45, 6)]),
    session('a', '2026-11-02', [set(40, 10), set(40, 8, false)]),
    session('c', '2026-11-11', [set(60, 1)], false),
  ]

  it('gives one point per day, oldest first, ignoring unfinished sessions', () => {
    const series = progressSeries(sessions, 'bench')
    expect(series.map((p) => [p.date, p.topWeight, p.topReps, p.volume])).toEqual([
      ['2026-11-02', 40, 10, 400],
      ['2026-11-09', 45, 6, 695],
    ])
  })

  it('leaves warm-up and prep sets out when there are work sets', () => {
    const [point] = progressSeries([session('d', '2026-11-03', [set(60, 5, true, 'prep'), set(50, 8), set(50, 7)])], 'bench')
    expect([point.topWeight, point.topReps, point.volume]).toEqual([50, 8, 750])
  })

  it('sums the volume of done sets', () => {
    expect(sessionVolume(sessions[1])).toBe(400)
  })
})

describe('weeks', () => {
  it('starts on Monday', () => {
    expect(weekStart('2026-11-12')).toBe('2026-11-09')
    expect(weekStart('2026-11-15')).toBe('2026-11-09')
    expect(weekStart('2026-11-09')).toBe('2026-11-09')
  })

  it('counts finished sessions of the current week', () => {
    const sessions = [
      session('a', '2026-11-08', [set(40, 10)]),
      session('b', '2026-11-09', [set(40, 10)]),
      session('c', '2026-11-12', [set(40, 10)], false),
    ]
    expect(sessionsThisWeek(sessions, '2026-11-12')).toBe(1)
  })
})
