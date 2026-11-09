import { describe, expect, it } from 'vitest'
import { addDays, addMonths, dayOfMonth, formatBytes, formatPercent, parseKm, parseMoney, shiftMonth } from './format'

describe('parseMoney', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['R$ 1.234', 123400],
    ['1234.56', 123456],
    ['1.234', 123400],
    ['19,99', 1999],
    ['0,1', 10],
    ['-50', -5000],
  ])('reads %s as %i cents', (input, cents) => {
    expect(parseMoney(input)).toBe(cents)
  })

  it('returns null when there is no number', () => {
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('')).toBeNull()
  })
})

describe('dates', () => {
  it('adds days across a year', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('clamps to the last day of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15')
  })

  it('shifts months across a year', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('clamps a day to the month', () => {
    expect(dayOfMonth('2026-02', 31)).toBe('2026-02-28')
    expect(dayOfMonth('2026-02', 0)).toBe('2026-02-01')
    expect(dayOfMonth('2026-10', 6)).toBe('2026-10-06')
  })
})

describe('formatting', () => {
  it('reads odometer input', () => {
    expect(parseKm('45.230 km')).toBe(45230)
    expect(parseKm('')).toBeNull()
  })

  it('formats sizes', () => {
    expect(formatBytes(500)).toBe('1 KB')
    expect(formatBytes(2_500_000)).toBe('2,4 MB')
  })

  it('formats a change, or nothing without a base', () => {
    expect(formatPercent(110, 100)).toBe('+10,0%')
    expect(formatPercent(90, 100)).toBe('-10,0%')
    expect(formatPercent(10, 0)).toBeNull()
    expect(formatPercent(10, undefined)).toBeNull()
  })
})
