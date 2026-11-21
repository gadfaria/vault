import type { LucideIcon } from 'lucide-react'
import { BellIcon, CarIcon, HeartPulseIcon, IdCardIcon, LandmarkIcon, PiggyBankIcon, ReceiptTextIcon, RepeatIcon } from 'lucide-react'
import { daysUntil, formatDate, formatMoney } from '@/lib/format'
import { billHref } from '@/modules/bills/types'
import type { MonthRow } from '@/modules/bills/useBills'
import { documentLabel } from '@/modules/documents/types'
import type { DocumentRow } from '@/modules/documents/useDocuments'
import type { Investment } from '@/modules/finance/types'
import { ENTRY_KINDS, type HealthEntry } from '@/modules/health/types'
import { scheduleLabel } from '@/modules/reminders/types'
import type { ReminderRow } from '@/modules/reminders/useReminders'
import type { SubscriptionRow } from '@/modules/subscriptions/useSubscriptions'
import { policyStatus, vehicleLabel } from '@/modules/vehicles/types'
import type { VehicleSummary } from '@/modules/vehicles/useVehicles'

export type Severity = 'danger' | 'warning' | 'info'

/** Something on the calendar or needing attention, from any module. */
export interface HomeEvent {
  id: string
  icon: LucideIcon
  severity: Severity
  /** YYYY-MM-DD the event refers to (due date, expiry, follow-up…) */
  date: string
  title: string
  detail: string
  /** Short trailing info for the agenda (amount, person…) */
  meta: string
  href: string
  /** Marks it done right from the list (reminders) */
  onComplete?: () => void
  /** Reminders only: the color picked for the calendar */
  color?: string
  /** Reminders only: opens its details instead of following `href` */
  reminderId?: string
}

/** Agenda horizon and how close something must be to need attention. */
export const AGENDA_DAYS = 30
const SOON_DAYS = 7
const STALE_BALANCE_DAYS = 30

export interface EventSources {
  billRows: MonthRow[]
  subscriptions: SubscriptionRow[]
  documents: DocumentRow[]
  health: { person: string; upcoming: HealthEntry[] }[]
  vehicles: VehicleSummary[]
  balancesUpdatedAt: string | undefined
  /** Active (not redeemed) investments */
  investments: Investment[]
  reminders: ReminderRow[]
  completeReminder: (row: ReminderRow) => void
}

export function collectEvents(sources: EventSources): HomeEvent[] {
  const events: HomeEvent[] = []

  for (const row of sources.billRows) {
    if (row.status === 'paid') continue
    const days = daysUntil(row.dueDate)
    if (days > AGENDA_DAYS) continue
    const amount = row.amount ? ` · ${formatMoney(row.amount)}${row.estimated ? ' (estimado)' : ''}` : ''
    events.push({
      id: `bill-${row.bill.id}-${row.dueDate}`,
      icon: ReceiptTextIcon,
      severity: row.status === 'overdue' ? 'danger' : days <= SOON_DAYS ? 'warning' : 'info',
      date: row.dueDate,
      title: `${row.status === 'overdue' ? 'Conta atrasada' : 'Conta a vencer'}: ${row.bill.name}`,
      detail: `${row.status === 'overdue' ? 'Venceu' : 'Vence'} em ${formatDate(row.dueDate)}${amount}`,
      meta: row.amount ? formatMoney(row.amount) : '',
      href: billHref(row.bill),
    })
  }

  for (const row of sources.reminders) {
    const days = daysUntil(row.due)
    if (days > AGENDA_DAYS) continue
    const soon = days <= row.reminder.leadDays
    events.push({
      id: `reminder-${row.reminder.id}-${row.date}`,
      icon: BellIcon,
      severity: row.status === 'overdue' ? 'danger' : row.status === 'today' || soon ? 'warning' : 'info',
      date: row.due,
      title: `${row.status === 'overdue' ? 'Lembrete atrasado' : 'Lembrete'}: ${row.reminder.title}`,
      detail: scheduleLabel(row.reminder),
      meta: '',
      href: '#/reminders',
      onComplete: () => sources.completeReminder(row),
      color: row.reminder.color,
      reminderId: row.reminder.id,
    })
  }

  for (const { subscription, next } of sources.subscriptions) {
    if (!next || daysUntil(next) > AGENDA_DAYS) continue
    events.push({
      id: `sub-${subscription.id}-${next}`,
      icon: RepeatIcon,
      severity: 'info',
      date: next,
      title: `Cobrança: ${subscription.name}`,
      detail: `${formatMoney(subscription.amount)}${subscription.paymentMethod ? ` · ${subscription.paymentMethod}` : ''}`,
      meta: formatMoney(subscription.amount),
      href: '#/bills/subscriptions',
    })
  }

  for (const { document, status } of sources.documents) {
    if (status.kind !== 'expired' && status.kind !== 'soon') continue
    const owner = document.owner ? ` (${document.owner})` : ''
    events.push({
      id: `doc-${document.id}`,
      icon: IdCardIcon,
      severity: status.kind === 'expired' ? 'danger' : 'warning',
      date: document.expiryDate,
      title: `${status.kind === 'expired' ? 'Documento vencido' : 'Documento vencendo'}: ${documentLabel(document)}${owner}`,
      detail: `${status.kind === 'expired' ? 'Venceu' : 'Vence'} em ${formatDate(document.expiryDate)}`,
      meta: document.owner,
      href: '#/documents',
    })
  }

  for (const { vehicle, currentPolicy, nextPolicy } of sources.vehicles) {
    if (!currentPolicy || nextPolicy) continue
    const status = policyStatus(currentPolicy)
    if (status.kind !== 'expired' && status.kind !== 'soon') continue
    events.push({
      id: `policy-${currentPolicy.id}`,
      icon: CarIcon,
      severity: status.kind === 'expired' ? 'danger' : 'warning',
      date: currentPolicy.endDate,
      title: status.kind === 'expired' ? `Seguro do ${vehicleLabel(vehicle)} vencido` : `Renovar seguro do ${vehicleLabel(vehicle)}`,
      detail: `${currentPolicy.insurer} · ${status.kind === 'expired' ? 'venceu' : 'vence'} em ${formatDate(currentPolicy.endDate)}`,
      meta: currentPolicy.insurer,
      href: `#/vehicles/${vehicle.id}`,
    })
  }

  for (const { person, upcoming } of sources.health) {
    for (const entry of upcoming) {
      const days = daysUntil(entry.nextDate)
      if (days > AGENDA_DAYS) continue
      events.push({
        id: `health-${entry.id}`,
        icon: HeartPulseIcon,
        severity: days <= SOON_DAYS ? 'warning' : 'info',
        date: entry.nextDate,
        title: `${entry.kind === 'vaccine' ? 'Próxima dose' : entry.kind === 'appointment' ? 'Retorno' : ENTRY_KINDS[entry.kind]}: ${entry.title}`,
        detail: [person, entry.provider].filter(Boolean).join(' · '),
        meta: person,
        href: '#/health',
      })
    }
  }

  for (const investment of sources.investments) {
    if (!investment.maturity) continue
    const days = daysUntil(investment.maturity)
    if (days > AGENDA_DAYS) continue
    events.push({
      id: `investment-${investment.id}`,
      icon: PiggyBankIcon,
      severity: days <= SOON_DAYS ? 'warning' : 'info',
      date: investment.maturity,
      title: days < 0 ? `Registre o resgate: ${investment.name}` : `Vence aplicação: ${investment.name}`,
      detail: `${investment.institution} · ${formatMoney(investment.amount)} · ${days < 0 ? 'venceu' : 'vence'} em ${formatDate(investment.maturity)}`,
      meta: formatMoney(investment.amount),
      href: '#/finance',
    })
  }

  if (sources.balancesUpdatedAt && daysUntil(sources.balancesUpdatedAt) < -STALE_BALANCE_DAYS) {
    events.push({
      id: 'finance-stale',
      icon: LandmarkIcon,
      severity: 'info',
      date: sources.balancesUpdatedAt,
      title: 'Atualize os saldos',
      detail: `Última atualização em ${formatDate(sources.balancesUpdatedAt)}`,
      meta: '',
      href: '#/finance',
    })
  }

  return events
}
