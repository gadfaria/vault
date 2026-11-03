import { useCallback, useMemo } from 'react'
import { newSyncable, touch } from '@/domain/merge'
import type { Attachment, Syncable } from '@/domain/types'
import { dayOfMonth, shiftMonth, today } from '@/lib/format'
import { useAttachments } from '@/storage/useAttachments'
import { useCollection } from '@/storage/useCollection'
import type { Subscription } from '../subscriptions/types'
import { billFrequency, chargesIn, FREQUENCIES, installmentIn, isDueIn, type Bill, type BillPayment, type BillsData, type BillStatus, type CardPurchase } from './types'

const EMPTY: BillsData = { bills: [], payments: [], purchases: [] }

export type BillInput = Omit<Bill, keyof Syncable>
export type PaymentInput = Pick<BillPayment, 'amount' | 'dueDate' | 'paidAt' | 'notes'>
export type PurchaseInput = Omit<CardPurchase, keyof Syncable>

/** A card purchase as it stands in one statement. */
export interface PurchaseRow {
  purchase: CardPurchase
  /** Which installment this is, from 1 */
  number: number
  /** This statement's share, in cents */
  amount: number
}

/** A subscription charged in one statement. */
export interface SubscriptionCharge {
  subscription: Subscription
  /** YYYY-MM-DD */
  date: string
}

/** A bill as it stands in one month. */
export interface MonthRow {
  bill: Bill
  payment: BillPayment | undefined
  dueDate: string
  /** The real amount when entered, otherwise the estimate, or the card's purchases and subscriptions if they add up to more */
  amount: number
  estimated: boolean
  status: BillStatus
  /** On cards, the purchases in this month's statement */
  purchases: PurchaseRow[]
  /** On cards, the subscriptions charged in this month's statement */
  charges: SubscriptionCharge[]
}

export interface HistoryPoint {
  month: string
  amount: number | null
}

/** Up to `count` months the bill was due in, up to `upTo`, oldest first. */
function dueMonths(bill: Bill, upTo: string, count: number): string[] {
  const months: string[] = []
  for (let month = upTo; month >= bill.startMonth && months.length < count; month = shiftMonth(month, -1)) {
    if (isDueIn(bill, month)) months.unshift(month)
  }
  return months
}

export function useBills() {
  const { data, loading, save } = useCollection('bills', EMPTY)
  const attachments = useAttachments('bills')

  const live = useMemo(
    () => ({
      bills: (data?.bills ?? []).filter((b) => !b.deleted).sort((a, b) => a.dueDay - b.dueDay || a.name.localeCompare(b.name)),
      payments: (data?.payments ?? []).filter((p) => !p.deleted),
      purchases: (data?.purchases ?? []).filter((p) => !p.deleted).sort((a, b) => b.date.localeCompare(a.date)),
    }),
    [data],
  )

  const paymentFor = useCallback(
    (billId: string, month: string) =>
      live.payments
        .filter((p) => p.billId === billId && p.month === month)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0],
    [live],
  )

  const purchasesIn = useCallback(
    (cardId: string, month: string): PurchaseRow[] =>
      live.purchases
        .filter((p) => p.cardId === cardId)
        .flatMap((purchase) => {
          const installment = installmentIn(purchase, month)
          return installment ? [{ purchase, ...installment }] : []
        }),
    [live],
  )

  /** Every bill that applies to `month`, with its amount and status. Cards count the `subscriptions` charged to them. */
  const monthRows = useCallback(
    (month: string, subscriptions: Subscription[] = []): MonthRow[] => {
      const now = today()
      return live.bills
        .filter((bill) => isDueIn(bill, month))
        .map((bill) => {
          const payment = paymentFor(bill.id, month)
          const dueDate = payment?.dueDate || dayOfMonth(month, bill.dueDay)
          const status: BillStatus = payment?.paidAt ? 'paid' : dueDate < now ? 'overdue' : 'pending'
          const purchases = purchasesIn(bill.id, month)
          const charges = subscriptions
            .filter((subscription) => subscription.cardId === bill.id)
            .flatMap((subscription) => chargesIn(subscription, bill, month).map((date) => ({ subscription, date })))
          const charged = [...purchases.map((p) => p.amount), ...charges.map((c) => c.subscription.amount)].reduce((sum, amount) => sum + amount, 0)
          return {
            bill,
            payment,
            dueDate,
            amount: payment ? payment.amount : Math.max(bill.estimate, charged),
            estimated: !payment,
            status,
            purchases,
            charges,
          }
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.bill.name.localeCompare(b.bill.name))
    },
    [live, paymentFor, purchasesIn],
  )

  /**
   * A monthly bill's last `count` months, or the last `count` due months of a less frequent one,
   * oldest first, null where nothing was entered.
   */
  const history = useCallback(
    (bill: Bill, upTo: string, count = 12): HistoryPoint[] => {
      const months =
        FREQUENCIES[billFrequency(bill)].months === 1
          ? Array.from({ length: count }, (_, i) => shiftMonth(upTo, i - count + 1))
          : dueMonths(bill, upTo, count)
      return months.map((month) => ({ month, amount: paymentFor(bill.id, month)?.amount ?? null }))
    },
    [paymentFor],
  )

  const saveBill = useCallback(
    (input: BillInput, existing?: Bill) =>
      save({ bills: [existing ? touch(existing, input) : { ...newSyncable(), ...input }] }),
    [save],
  )

  /** Stops listing a bill from the given month on, keeping its history. */
  const endBill = useCallback(
    (bill: Bill, lastMonth: string) => save({ bills: [touch(bill, { endMonth: lastMonth })] }),
    [save],
  )

  const deleteBill = useCallback(
    async (bill: Bill) => {
      const payments = live.payments.filter((p) => p.billId === bill.id)
      const ok = await save({
        bills: [touch(bill, { deleted: true })],
        payments: payments.map((p) => touch(p, { deleted: true })),
        purchases: live.purchases.filter((p) => p.cardId === bill.id).map((p) => touch(p, { deleted: true })),
      })
      if (ok) await attachments.trash(payments.flatMap((p) => p.attachments))
      return ok
    },
    [save, live, attachments],
  )

  /** Creates or updates a month's entry; uploads new files first and trashes removed ones after. */
  const savePayment = useCallback(
    async (bill: Bill, month: string, input: PaymentInput, newFiles: File[] = [], removed: Attachment[] = []) => {
      const uploaded = newFiles.length ? await attachments.upload(newFiles) : []
      if (uploaded === null) return false
      const existing = paymentFor(bill.id, month)
      const removedIds = new Set(removed.map((a) => a.id))
      const kept = (existing?.attachments ?? []).filter((a) => !removedIds.has(a.id))
      const next = { ...input, attachments: [...kept, ...uploaded] }
      const ok = await save({
        payments: [existing ? touch(existing, next) : { ...newSyncable(), billId: bill.id, month, ...next }],
      })
      if (ok && removed.length) await attachments.trash(removed)
      return ok
    },
    [save, attachments, paymentFor],
  )

  const undoPayment = useCallback(
    (payment: BillPayment) => save({ payments: [touch(payment, { paidAt: '' })] }),
    [save],
  )

  const savePurchase = useCallback(
    (input: PurchaseInput, existing?: CardPurchase) =>
      save({ purchases: [existing ? touch(existing, input) : { ...newSyncable(), ...input }] }),
    [save],
  )

  const deletePurchase = useCallback(
    (purchase: CardPurchase) => save({ purchases: [touch(purchase, { deleted: true })] }),
    [save],
  )

  return { loading, bills: live.bills, purchases: live.purchases, monthRows, history, saveBill, endBill, deleteBill, savePayment, undoPayment, savePurchase, deletePurchase }
}
