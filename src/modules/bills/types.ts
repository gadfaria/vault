import type { Attachment, Syncable } from '@/domain/types'
import { addMonths, dayOfMonth, parseDate, shiftMonth } from '@/lib/format'
import { CYCLES, type Subscription } from '../subscriptions/types'

/** What money is spent on: card purchases use these, and so can bills (e.g. a one-off Pix purchase). */
export const PURCHASE_CATEGORIES = {
  groceries: 'Supermercado',
  food: 'Comida',
  transport: 'Transporte',
  car: 'Carro',
  home: 'Casa',
  pet: 'Pet',
  health: 'Saúde',
  education: 'Educação',
  leisure: 'Lazer',
  travel: 'Viagem',
  clothing: 'Roupas',
  beauty: 'Beleza e cuidados',
  gifts: 'Presentes',
  services: 'Serviços',
  shopping: 'Compras',
  other: 'Outros',
} as const

export type PurchaseCategory = keyof typeof PURCHASE_CATEGORIES

/** Household bills first, then every purchase category. */
export const BILL_CATEGORIES = {
  rent: 'Aluguel',
  condo: 'Condomínio',
  electricity: 'Luz',
  water: 'Água',
  gas: 'Gás',
  internet: 'Internet e telefone',
  creditCard: 'Fatura do cartão',
  tax: 'Impostos e taxas',
  ...PURCHASE_CATEGORIES,
} as const

export type BillCategory = keyof typeof BILL_CATEGORIES

export const PAYMENT_METHODS = {
  boleto: 'Boleto',
  autoDebit: 'Débito automático',
  pix: 'Pix',
  card: 'Cartão',
  other: 'Outro',
} as const

export type PaymentMethod = keyof typeof PAYMENT_METHODS

/** How often a bill comes and how many months apart (0: only once, in its start month). */
export const FREQUENCIES = {
  monthly: { label: 'Mensal', months: 1 },
  bimonthly: { label: 'Bimestral', months: 2 },
  quarterly: { label: 'Trimestral', months: 3 },
  semiannual: { label: 'Semestral', months: 6 },
  yearly: { label: 'Anual', months: 12 },
  once: { label: 'Avulsa', months: 0 },
} as const

export type BillFrequency = keyof typeof FREQUENCIES

/** A bill with a varying amount, due every month, every few months or just once. */
export interface Bill extends Syncable {
  name: string
  category: BillCategory
  /** Missing on bills saved before frequencies existed, which are monthly */
  frequency?: BillFrequency
  /** Day of the month it is due (clamped to short months) */
  dueDay: number
  paymentMethod: PaymentMethod
  /** Expected amount in cents, used until the real one is entered */
  estimate: number
  /** First month it applies to, YYYY-MM (earlier months don't list it). Later ones repeat every cycle from it. */
  startMonth: string
  /** Last month it applies to, YYYY-MM, or empty while active */
  endMonth: string
  notes: string
  /** Set on credit cards (category creditCard): the bill is the card's monthly statement */
  card?: CardDetails
}

/** A credit card. Only the last digits: the full number, CVV or password never go in the vault. */
interface CardDetails {
  bank: string
  /** Last 4 digits, or empty */
  lastDigits: string
  /** Credit limit in cents, 0 when not set */
  limit: number
  /** Day the statement closes, 0 when not set */
  closingDay: number
}

/** Credit cards are bills of category creditCard; older ones may have no details yet. */
export function isCard(bill: Pick<Bill, 'category'>): boolean {
  return bill.category === 'creditCard'
}

/** Where a bill is listed: cards in Cartões, the others in Contas. */
export function billHref(bill: Pick<Bill, 'category'>): string {
  return isCard(bill) ? '#/bills/cards' : '#/bills/list'
}

/** "Nubank •••• 1234" */
export function cardLabel(bill: Pick<Bill, 'card'>): string {
  const card = bill.card
  if (!card) return ''
  return [card.bank, card.lastDigits && `•••• ${card.lastDigits}`].filter(Boolean).join(' ')
}

/** One month of a bill: the real amount and whether it was paid. */
export interface BillPayment extends Syncable {
  billId: string
  /** YYYY-MM */
  month: string
  /** In cents */
  amount: number
  /** YYYY-MM-DD */
  dueDate: string
  /** YYYY-MM-DD when paid, empty while pending */
  paidAt: string
  notes: string
  attachments: Attachment[]
}

/** A purchase charged to a card, in one statement or split over several. */
export interface CardPurchase extends Syncable {
  /** The card (a creditCard bill id) */
  cardId: string
  description: string
  /** Missing on purchases saved before categories existed, which count as other */
  category?: PurchaseCategory
  /** Total in cents */
  amount: number
  /** YYYY-MM-DD */
  date: string
  /** 1 when paid in full */
  installments: number
  /** Statement of the first installment, YYYY-MM (the month that statement is due) */
  firstMonth: string
}

export type BillsData = {
  bills: Bill[]
  payments: BillPayment[]
  purchases: CardPurchase[]
}

export function billFrequency(bill: Pick<Bill, 'frequency'>): BillFrequency {
  return bill.frequency ?? 'monthly'
}

/** Whether the bill is due in a YYYY-MM month. */
export function isDueIn(bill: Pick<Bill, 'frequency' | 'startMonth' | 'endMonth'>, month: string): boolean {
  if (month < bill.startMonth || (bill.endMonth && month > bill.endMonth)) return false
  const step = FREQUENCIES[billFrequency(bill)].months
  if (step === 0) return month === bill.startMonth
  return monthsBetween(bill.startMonth, month) % step === 0
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/**
 * The statement a purchase falls in, as the month it is due: a purchase on the closing day or later
 * goes to the next one, and a card due on or before its closing day is paid the month after closing.
 * Cards with no closing day count from the due day.
 */
export function firstStatementMonth(card: Pick<Bill, 'dueDay' | 'card'>, date: string): string {
  const month = date.slice(0, 7)
  const day = Number(date.slice(8, 10))
  const closing = card.card?.closingDay ?? 0
  if (!closing) return day < card.dueDay ? month : shiftMonth(month, 1)
  const closes = day < closing ? month : shiftMonth(month, 1)
  return card.dueDay > closing ? closes : shiftMonth(closes, 1)
}

/**
 * The month most of a statement's purchases were made in: it covers the days up to the one before
 * closing (the due day when there is none), so the closing month if that is past mid-month, else the one before.
 */
export function statementSpendMonth(card: Pick<Bill, 'dueDay' | 'card'>, month: string): string {
  const closing = card.card?.closingDay ?? 0
  const closes = !closing || card.dueDay > closing ? month : shiftMonth(month, -1)
  return (closing || card.dueDay) - 1 >= 15 ? closes : shiftMonth(closes, -1)
}

/** The purchase's installment in a statement, numbered from 1, or null if it has none there. The first one takes the leftover cents. */
export function installmentIn(
  purchase: Pick<CardPurchase, 'amount' | 'installments' | 'firstMonth'>,
  month: string,
): { number: number; amount: number } | null {
  const index = monthsBetween(purchase.firstMonth, month)
  if (index < 0 || index >= purchase.installments) return null
  const base = Math.floor(purchase.amount / purchase.installments)
  return { number: index + 1, amount: index === 0 ? purchase.amount - base * (purchase.installments - 1) : base }
}

/** A subscription's charges that fall in a card's statement, as YYYY-MM-DD. Stops at its cancellation. */
export function chargesIn(
  subscription: Pick<Subscription, 'startDate' | 'cycle' | 'cancelledAt'>,
  card: Pick<Bill, 'dueDay' | 'card'>,
  month: string,
): string[] {
  const step = CYCLES[subscription.cycle].months
  // A charge reaches a statement at most two months later, so start a little before that.
  const start = Math.max(0, Math.floor((monthsBetween(subscription.startDate.slice(0, 7), month) - 3) / step))
  const charges: string[] = []
  for (let cycle = start; ; cycle += 1) {
    const date = addMonths(subscription.startDate, cycle * step)
    if (date.slice(0, 7) > month || (subscription.cancelledAt && date > subscription.cancelledAt)) return charges
    if (firstStatementMonth(card, date) === month) charges.push(date)
  }
}

/** "vence dia 10"; "trimestral · dia 10 (jan, abr, jul, out)"; "anual · 10 de março"; "avulsa · 10/03/2027" */
export function scheduleLabel(bill: Pick<Bill, 'frequency' | 'dueDay' | 'startMonth'>): string {
  const frequency = billFrequency(bill)
  if (frequency === 'monthly') return `vence dia ${bill.dueDay}`
  const label = FREQUENCIES[frequency].label.toLowerCase()
  const first = parseDate(dayOfMonth(bill.startMonth, bill.dueDay))
  if (frequency === 'once') return `${label} · ${first.toLocaleDateString('pt-BR')}`
  if (frequency === 'yearly') return `${label} · ${first.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`
  const step = FREQUENCIES[frequency].months
  const months = Array.from({ length: 12 / step }, (_, i) =>
    new Date(2000, (first.getMonth() + i * step) % 12, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
  )
  return `${label} · dia ${bill.dueDay} (${months.join(', ')})`
}

export type BillStatus = 'paid' | 'pending' | 'overdue'

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  paid: 'Paga',
  pending: 'Pendente',
  overdue: 'Atrasada',
}
