import { describe, expect, it } from 'vitest'
import { around, occurrences, periodEnd, type Reminder } from './types'

type Schedule = Pick<Reminder, 'frequency' | 'interval' | 'weekdays' | 'startDate' | 'endDate'>

const schedule = (changes: Partial<Schedule>): Schedule => ({ frequency: 'daily', interval: 1, weekdays: [], startDate: '2026-01-01', ...changes })

/** The first `count` dates of a schedule that may never end. */
function first(reminder: Schedule, count: number): string[] {
  const dates: string[] = []
  for (const date of occurrences(reminder)) {
    dates.push(date)
    if (dates.length === count) break
  }
  return dates
}

describe('occurrences', () => {
  it('happens once', () => {
    expect([...occurrences(schedule({ frequency: 'once' }))]).toEqual(['2026-01-01'])
  })

  it('repeats every N days', () => {
    expect(first(schedule({ interval: 2 }), 3)).toEqual(['2026-01-01', '2026-01-03', '2026-01-05'])
  })

  it('repeats on the chosen weekdays, never before the start', () => {
    // 2026-11-10 is a Tuesday; Monday of that week is already past.
    const weekly = schedule({ frequency: 'weekly', weekdays: [3, 1], startDate: '2026-11-10' })
    expect(first(weekly, 3)).toEqual(['2026-11-11', '2026-11-16', '2026-11-18'])
  })

  it('clamps day 31 to shorter months without drifting', () => {
    const monthly = schedule({ frequency: 'monthly', startDate: '2026-01-31' })
    expect(first(monthly, 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('stops at the end date', () => {
    expect([...occurrences(schedule({ endDate: '2026-01-03' }))]).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })
})

describe('around', () => {
  it('finds the occurrence on or before a date and the next one', () => {
    expect(around(schedule({}), '2026-01-02')).toEqual({ last: '2026-01-02', next: '2026-01-03' })
  })

  it('has nothing before the start', () => {
    expect(around(schedule({}), '2025-12-31')).toEqual({ last: undefined, next: '2026-01-01' })
  })
})

describe('periodEnd', () => {
  it('is the end date of a one-time reminder that spans days', () => {
    expect(periodEnd({ frequency: 'once', startDate: '2026-03-10', endDate: '2026-03-15' }, '2026-03-10')).toBe('2026-03-15')
  })

  it('is the date itself for repeating reminders', () => {
    expect(periodEnd({ frequency: 'daily', startDate: '2026-03-10', endDate: '2026-03-15' }, '2026-03-10')).toBe('2026-03-10')
  })
})
