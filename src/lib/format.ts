import { valuesHidden } from './privacy'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatMoney(cents: number): string {
  if (valuesHidden()) return 'R$ ••••'
  return brl.format(cents / 100)
}

/** Formats cents for an input field: 123456 → "1.234,56". */
export function formatMoneyInput(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Parses what a person types into cents. Accepts "1.234,56", "1234,56",
 * "R$ 1.234", "1234.56" and negatives (debts). Returns null when unreadable.
 */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, '')
  if (!/\d/.test(cleaned)) return null
  let normalized: string
  if (cleaned.includes(',')) normalized = cleaned.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d+\.\d{1,2}$/.test(cleaned)) normalized = cleaned
  else normalized = cleaned.replace(/\./g, '')
  const value = Number(normalized)
  return Number.isFinite(value) ? Math.round(value * 100) : null
}

/** YYYY-MM-DD → local Date (new Date('2026-10-24') would be UTC midnight, the previous day in Brazil). */
export function parseDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Today as YYYY-MM-DD in local time. */
export function today(): string {
  return toIsoDate(new Date())
}

export function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return toIsoDate(date)
}

export function monthsAgo(months: number): string {
  const date = new Date()
  date.setMonth(date.getMonth() - months)
  return toIsoDate(date)
}

export function endOfPreviousMonth(): string {
  const now = new Date()
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 0))
}

/** Adds days to a YYYY-MM-DD date (negative to go back). */
export function addDays(isoDate: string, days: number): string {
  const date = parseDate(isoDate)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** Adds months to a YYYY-MM-DD date, clamping to the month's last day (Jan 31 + 1 → Feb 28). */
export function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const target = new Date(year, month - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, lastDay))
  return toIsoDate(target)
}

/** Current month as YYYY-MM. */
export function currentMonth(): string {
  return today().slice(0, 7)
}

/** Shifts a YYYY-MM month by n months. */
export function shiftMonth(month: string, n: number): string {
  return addMonths(`${month}-01`, n).slice(0, 7)
}

/** "2026-10" → "outubro de 2026"; short: "out/26" */
export function formatMonth(month: string, short = false): string {
  const date = parseDate(`${month}-01`)
  if (!short) return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return `${date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${month.slice(2, 4)}`
}

/** Day `day` of a YYYY-MM month, clamped to the month's last day (31 in February → 28/29). */
export function dayOfMonth(month: string, day: number): string {
  const [year, m] = month.split('-').map(Number)
  const lastDay = new Date(year, m, 0).getDate()
  return `${month}-${String(Math.min(Math.max(1, day), lastDay)).padStart(2, '0')}`
}

/** Whole days from today until `isoDate` (negative when it is in the past). */
export function daysUntil(isoDate: string): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((parseDate(isoDate).getTime() - start.getTime()) / 86_400_000)
}

export function formatDate(isoDate: string, options?: Intl.DateTimeFormatOptions): string {
  return parseDate(isoDate).toLocaleDateString('pt-BR', options)
}

/** "24 out" — compact day + month for chart axes. */
export function formatShortDate(isoDate: string): string {
  const date = parseDate(isoDate)
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return `${date.getDate()} ${month}`
}

/** "+12,5%" / "-3,0%"; null when there is nothing to compare against. */
export function formatPercent(current: number, base: number | undefined): string | null {
  if (base === undefined || base === 0) return null
  const pct = ((current - base) / Math.abs(base)) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export function formatSignedMoney(cents: number): string {
  return `${cents > 0 ? '+' : ''}${formatMoney(cents)}`
}

const km = new Intl.NumberFormat('pt-BR')

/** 45230 → "45.230 km" */
export function formatKm(value: number): string {
  return `${km.format(value)} km`
}

/** Parses an odometer reading typed as "45.230" or "45230 km". Returns null when unreadable. */
export function parseKm(input: string): number | null {
  const digits = input.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

/** 2_500_000 → "2,4 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1).replace('.', ',')} GB`
}

/** 0.135 → "+13,5%" */
export function formatRatio(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
