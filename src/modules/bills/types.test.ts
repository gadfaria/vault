import { describe, expect, it } from 'vitest'
import { firstStatementMonth, installmentIn, isDueIn, type Bill } from './types'

const card = (dueDay: number, closingDay: number): Pick<Bill, 'dueDay' | 'card'> => ({
  dueDay,
  card: { bank: '', lastDigits: '', limit: 0, closingDay },
})

describe('isDueIn', () => {
  it('is due every month from the start until the end', () => {
    const bill = { frequency: undefined, startMonth: '2026-03', endMonth: '2026-05' }
    expect(['2026-02', '2026-03', '2026-05', '2026-06'].map((month) => isDueIn(bill, month))).toEqual([false, true, true, false])
  })

  it('repeats every cycle from the first month', () => {
    const bill = { frequency: 'quarterly' as const, startMonth: '2026-11', endMonth: '' }
    expect(['2026-11', '2026-12', '2027-02', '2027-05'].map((month) => isDueIn(bill, month))).toEqual([true, false, true, true])
  })
})

describe('firstStatementMonth', () => {
  it('moves a purchase on the closing day to the next statement', () => {
    expect(firstStatementMonth(card(10, 3), '2026-11-02')).toBe('2026-11')
    expect(firstStatementMonth(card(10, 3), '2026-11-03')).toBe('2026-12')
  })

  it('is due the month after closing when the due day comes first', () => {
    expect(firstStatementMonth(card(5, 28), '2026-11-15')).toBe('2026-12')
    expect(firstStatementMonth(card(5, 28), '2026-12-28')).toBe('2027-02')
  })

  it('counts from the due day without a closing day', () => {
    expect(firstStatementMonth(card(10, 0), '2026-11-09')).toBe('2026-11')
    expect(firstStatementMonth(card(10, 0), '2026-11-10')).toBe('2026-12')
  })
})

describe('installmentIn', () => {
  const purchase = { amount: 1000, installments: 3, firstMonth: '2026-01' }

  it('puts the leftover cents in the first installment', () => {
    expect(installmentIn(purchase, '2026-01')).toEqual({ number: 1, amount: 334 })
    expect(installmentIn(purchase, '2026-03')).toEqual({ number: 3, amount: 333 })
  })

  it('has nothing outside its statements', () => {
    expect(installmentIn(purchase, '2025-12')).toBeNull()
    expect(installmentIn(purchase, '2026-04')).toBeNull()
  })
})
