import { useState } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from 'lucide-react'
import { useAuth } from '@/auth/context'
import { PageBody } from '@/components/app-layout'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { currentMonth, daysUntil, formatDate, formatMonth, shiftMonth, today } from '@/lib/format'
import { useBills } from '@/modules/bills/useBills'
import { useDocuments } from '@/modules/documents/useDocuments'
import { useFinance } from '@/modules/finance/useFinance'
import { useHealth } from '@/modules/health/useHealth'
import { useReminderDialogs } from '@/modules/reminders/useReminderDialogs'
import { useReminders } from '@/modules/reminders/useReminders'
import { useSubscriptions } from '@/modules/subscriptions/useSubscriptions'
import { useVehicles } from '@/modules/vehicles/useVehicles'
import { reminderColor } from '@/modules/reminders/types'
import { collectCalendar, itemsOn, monthGrid, monthsBetween, weekSpans, type CalendarItem, type WeekSpan } from './calendar'
import { AGENDA_DAYS, collectEvents, type HomeEvent, type Severity } from './events'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function relativeDay(isoDate: string): string {
  const days = daysUntil(isoDate)
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Amanhã'
  if (days === -1) return 'Ontem'
  return days < 0 ? `Há ${-days} dias` : `Em ${days} dias`
}

export function HomeScreen() {
  const { session } = useAuth()
  const finance = useFinance()
  const bills = useBills()
  const subs = useSubscriptions()
  const docs = useDocuments()
  const health = useHealth()
  const vehicles = useVehicles()
  const reminders = useReminders()
  const loading =
    finance.loading || bills.loading || subs.loading || docs.loading || health.loading || vehicles.loading || reminders.loading

  const reminderDialogs = useReminderDialogs(reminders)

  const month = currentMonth()
  const billRows = bills.monthRows(month, subs.all)

  const events = loading
    ? []
    : collectEvents({
        // Next month's bills too, so early-month due dates show up in the agenda.
        billRows: [...billRows, ...bills.monthRows(shiftMonth(month, 1), subs.all)],
        subscriptions: subs.active,
        documents: docs.rows,
        health: health.people.map((person) => ({ person, upcoming: health.forPerson(person).upcoming })),
        vehicles: vehicles.summaries,
        balancesUpdatedAt: finance.lastUpdate,
        investments: finance.activeInvestments,
        reminders: reminders.active,
        completeReminder: reminderDialogs.complete,
      })

  const now = today()
  const agenda = events.filter((e) => e.date >= now && daysUntil(e.date) <= AGENDA_DAYS).sort((a, b) => a.date.localeCompare(b.date))

  const [shownMonth, setShownMonth] = useState(month)
  const [selected, setSelected] = useState(now)
  const grid = monthGrid(shownMonth)
  const gridFrom = grid[0]
  const gridTo = grid[grid.length - 1]
  const calendar = loading
    ? []
    : collectCalendar(gridFrom, gridTo, {
        reminders: reminders.inRange(gridFrom, gridTo),
        billRows: monthsBetween(gridFrom, gridTo).flatMap((m) => bills.monthRows(m, subs.all)),
        subscriptions: subs.active.map((r) => r.subscription),
        documents: docs.rows,
        health: health.people.map((person) => ({ person, upcoming: health.forPerson(person).upcoming })),
        vehicles: vehicles.summaries,
        investments: finance.activeInvestments,
      })

  function showMonth(next: string) {
    setShownMonth(next)
    // Keep today selected in its own month; elsewhere start from the 1st.
    setSelected(next === month ? now : `${next}-01`)
  }

  const firstName = session?.name.split(' ')[0] ?? ''

  return (
    <>
      <SiteHeader title="Início" />
      <PageBody>
        <div className="flex flex-col gap-0.5 px-4 lg:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            {greeting()}
            {firstName && `, ${firstName}`}
          </h2>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* Wide screens: the calendar takes the rest of the screen's height. */}
        <div className="flex flex-col px-4 lg:px-6 @4xl/main:flex-1">
          <CalendarCard
            loading={loading}
            month={shownMonth}
            grid={grid}
            items={calendar}
            selected={selected}
            onSelect={(day) => {
              setSelected(day)
              if (day.slice(0, 7) !== shownMonth) setShownMonth(day.slice(0, 7))
            }}
            onMonth={showMonth}
            agenda={agenda}
            onOpenReminder={(reminderId, date, done) => reminderDialogs.showDetails({ reminderId, date, done })}
            onNewReminder={reminderDialogs.create}
          />
        </div>

      </PageBody>
      {reminderDialogs.dialogs}
    </>
  )
}

const DOT: Record<Severity, string> = {
  danger: 'bg-destructive',
  warning: 'bg-foreground',
  info: 'bg-muted-foreground/40',
}

/** Follows `href`, except reminders: those open their details right here. */
function openLink(item: { reminderId?: string; date: string; done?: boolean }, onOpen: OpenReminder) {
  return (e: React.MouseEvent) => {
    if (!item.reminderId) return
    e.preventDefault()
    onOpen(item.reminderId, item.date, item.done)
  }
}

function Agenda({ events, onOpen }: { events: HomeEvent[]; onOpen: OpenReminder }) {
  const days = new Map<string, HomeEvent[]>()
  for (const event of events) days.set(event.date, [...(days.get(event.date) ?? []), event])

  return (
    <div className="flex flex-col gap-4">
      {[...days.entries()].map(([date, list]) => (
        <div key={date} className="flex gap-4">
          <div className="flex w-12 shrink-0 flex-col items-center rounded-md border py-1 leading-none">
            <span className="text-lg font-semibold tabular-nums">{date.slice(8, 10)}</span>
            <span className="text-[10px] text-muted-foreground uppercase">
              {formatDate(date, { month: 'short' }).replace('.', '')}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs text-muted-foreground">{relativeDay(date)}</span>
            <ul className="flex flex-col">
              {list.map((event) => (
                <li key={event.id}>
                  <a href={event.href} onClick={openLink(event, onOpen)} className="flex items-baseline gap-2 py-0.5 text-sm hover:underline">
                    <span
                      className={`size-1.5 shrink-0 translate-y-[-1px] rounded-full ${
                        event.severity === 'info' ? (reminderColor(event.color)?.dot ?? DOT.info) : DOT[event.severity]
                      }`}
                    />
                    <span className="truncate">{event.title}</span>
                    <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground tabular-nums">{event.meta}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  )
}

type OpenReminder = (reminderId: string, date: string, done?: boolean) => void

const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const NO_SPANS = { spans: [], lanes: 0 }
/** Items listed inside a day cell on wide screens; the rest become "+N". */
const CELL_ITEMS = 3

function itemTone(item: CalendarItem): string {
  if (item.late) return 'text-destructive'
  if (item.done) return 'text-muted-foreground line-through'
  // A past occurrence nobody marked: no longer asked for, so just faded.
  if (item.until < today()) return 'text-muted-foreground'
  return ''
}

/** Dot color for an item: state first (late, done or past), then its own color. */
function dotClass(item: CalendarItem): string {
  if (item.late) return 'bg-destructive'
  if (item.done || item.until < today()) return 'bg-muted-foreground/40'
  return reminderColor(item.color)?.dot ?? 'bg-foreground'
}

function DayCell({
  day,
  inMonth,
  selected,
  all,
  lanes,
  onSelect,
  onOpen,
}: {
  day: string
  inMonth: boolean
  selected: boolean
  /** Everything on this day, periods included */
  all: CalendarItem[]
  /** Period bars drawn over this week, which the cell leaves room for */
  lanes: number
  onSelect: (day: string) => void
  onOpen: OpenReminder
}) {
  // Periods are drawn as bars over the week; the cell lists only the single-day items.
  const singles = all.filter((item) => item.until === item.date)
  // Each period bar takes about a line of the cell, but always keep room for two titles.
  const room = Math.max(2, CELL_ITEMS + 1 - lanes)
  return (
    <button
      type="button"
      onClick={() => onSelect(day)}
      aria-pressed={selected}
      aria-label={`${formatDate(day, { day: 'numeric', month: 'long' })}${all.length ? `, ${all.length} ${all.length === 1 ? 'item' : 'itens'}` : ''}`}
      className={`flex min-h-14 min-w-0 flex-col items-stretch gap-0.5 p-1 text-left outline-none @4xl/main:min-h-24 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset ${
        selected ? 'bg-muted' : 'bg-card hover:bg-muted/60'
      } ${inMonth ? '' : 'text-muted-foreground/60'}`}
    >
      <span
        className={`flex size-6 shrink-0 items-center justify-center self-center rounded-full text-xs tabular-nums @4xl/main:self-start ${
          day === today() ? 'bg-primary font-semibold text-primary-foreground' : ''
        }`}
      >
        {Number(day.slice(8, 10))}
      </span>
      {/* Room for the period bars drawn over the week: thin lines on phones, labeled bars on wide screens. */}
      {lanes > 0 && <span className="h-[calc(var(--lanes)*0.375rem)] shrink-0 @4xl/main:h-[calc(var(--lanes)*1.125rem)]" />}
      {/* Phones: a dot per item (up to four). */}
      {singles.length > 0 && (
        <span className="flex justify-center gap-0.5 @4xl/main:hidden">
          {singles.slice(0, 4).map((item) => (
            <span key={item.id} className={`size-1.5 rounded-full ${dotClass(item)}`} />
          ))}
        </span>
      )}
      {/* Wide screens: the first few titles. */}
      <span className="hidden min-w-0 flex-col gap-0.5 @4xl/main:flex">
        {singles.slice(0, room).map((item) => (
          <span
            key={item.id}
            // Inside the day's button, so a span; the day's list below offers the same reminder by keyboard.
            onClick={
              item.reminderId
                ? (e) => {
                    e.stopPropagation()
                    onSelect(day)
                    onOpen(item.reminderId!, item.date, item.done)
                  }
                : undefined
            }
            className={`flex min-w-0 items-center gap-1 text-[11px] leading-4 ${itemTone(item)} ${item.reminderId ? 'rounded-sm hover:bg-foreground/10' : ''}`}
          >
            <item.icon className={`size-3 shrink-0 ${reminderColor(item.color)?.text ?? 'text-muted-foreground'}`} />
            <span className="truncate">{item.title}</span>
          </span>
        ))}
        {singles.length > room && <span className="text-[11px] leading-4 text-muted-foreground">+{singles.length - room}</span>}
      </span>
    </button>
  )
}

/** A period across part of a week: a thin line on phones, a labeled bar on wide screens. */
function SpanBar({ span, onOpen }: { span: WeekSpan; onOpen: OpenReminder }) {
  const { item } = span
  const color = reminderColor(item.color)
  const past = !item.late && (item.done || item.until < today())
  const ends = `${span.fromBefore ? '' : 'ml-0.5 rounded-l-sm'} ${span.goesOn ? '' : 'mr-0.5 rounded-r-sm'}`
  return (
    <span style={{ gridColumn: `${span.start + 1} / ${span.end + 2}`, gridRow: span.lane + 1 }} className={`min-w-0 ${past ? 'opacity-50' : ''}`}>
      <span className={`block h-1 @4xl/main:hidden ${ends} ${item.late ? 'bg-destructive' : color?.line ?? 'bg-foreground/60'}`} />
      <span
        onClick={item.reminderId ? () => onOpen(item.reminderId!, item.date, item.done) : undefined}
        className={`pointer-events-auto hidden h-4 cursor-pointer truncate px-1 text-[11px] leading-4 font-medium @4xl/main:block ${ends} ${color?.bar ?? 'bg-muted text-foreground'} ${
          item.late ? 'text-destructive ring-1 ring-destructive ring-inset' : ''
        } ${item.done ? 'line-through' : ''}`}
      >
        {/* Named at its start and again at the start of each week it continues into. */}
        {item.title}
      </span>
    </span>
  )
}

function CalendarCard({
  loading,
  month,
  grid,
  items,
  selected,
  onSelect,
  onMonth,
  agenda,
  onOpenReminder,
  onNewReminder,
}: {
  loading: boolean
  month: string
  grid: string[]
  items: CalendarItem[]
  selected: string
  onSelect: (day: string) => void
  onMonth: (month: string) => void
  agenda: HomeEvent[]
  onOpenReminder: OpenReminder
  onNewReminder: (date: string) => void
}) {
  const dayItems = itemsOn(items, selected)
  const weeks = Array.from({ length: grid.length / 7 }, (_, i) => grid.slice(i * 7, i * 7 + 7))

  return (
    <Card className="@4xl/main:flex-1">
      <CardHeader>
        <CardTitle className="first-letter:uppercase">{formatMonth(month)}</CardTitle>
        <CardDescription>Lembretes, contas, cobranças e vencimentos</CardDescription>
        <CardAction className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => onMonth(currentMonth())} disabled={month === currentMonth()}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onMonth(shiftMonth(month, -1))} aria-label="Mês anterior">
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onMonth(shiftMonth(month, 1))} aria-label="Próximo mês">
            <ChevronRightIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 @4xl/main:flex-1 @4xl/main:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col">
          <div className="grid grid-cols-7 pb-1 text-center text-xs text-muted-foreground">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="flex flex-col gap-px overflow-hidden rounded-md border bg-border @4xl/main:flex-1">
            {weeks.map((week) => {
              const { spans, lanes } = loading ? NO_SPANS : weekSpans(week, items)
              return (
                <div
                  key={week[0]}
                  className="relative grid grid-cols-7 gap-px @4xl/main:flex-1"
                  style={{ '--lanes': lanes } as React.CSSProperties}
                >
                  {week.map((day) => (
                    <DayCell
                      key={day}
                      day={day}
                      inMonth={day.slice(0, 7) === month}
                      selected={day === selected}
                      all={loading ? [] : itemsOn(items, day)}
                      lanes={lanes}
                      onSelect={onSelect}
                      onOpen={onOpenReminder}
                    />
                  ))}
                  {/* Periods: one bar across the days they cover, stacked when they overlap. Their label opens the reminder (phones: the day's list). */}
                  {spans.length > 0 && (
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[1.875rem] grid grid-cols-7 gap-x-px gap-y-0.5">
                      {spans.map((span) => (
                        <SpanBar key={`${span.item.id}-${week[0]}`} span={span} onOpen={onOpenReminder} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Wide screens: as tall as the calendar and scrolls inside; phones: below it, full length. */}
        <div className="relative min-w-0">
          <div className="flex flex-col gap-6 @4xl/main:absolute @4xl/main:inset-0 @4xl/main:overflow-y-auto @4xl/main:pr-1">
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium first-letter:uppercase">
                  {formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <span className="text-xs text-muted-foreground">{relativeDay(selected)}</span>
              </div>
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : dayItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada neste dia.</p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {dayItems.map((item) => (
                    <li key={item.id}>
                      <a href={item.href} onClick={openLink(item, onOpenReminder)} className="group flex items-center gap-3 py-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border">
                          {item.done ? (
                            <CheckIcon className="size-4 text-muted-foreground" />
                          ) : (
                            <item.icon className={`size-4 ${reminderColor(item.color)?.text ?? 'text-muted-foreground'}`} />
                          )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className={`truncate text-sm font-medium ${itemTone(item)}`}>{item.title}</span>
                          {item.until !== item.date && (
                            <span className="truncate text-xs text-muted-foreground">
                              {formatDate(item.date, { day: 'numeric', month: 'short' })} a {formatDate(item.until, { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </span>
                        {item.meta && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.meta}</span>}
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {!loading && (
                <Button variant="outline" size="sm" className="w-full border-dashed text-muted-foreground" onClick={() => onNewReminder(selected)}>
                  <PlusIcon />
                  Novo lembrete neste dia
                </Button>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Próximos {AGENDA_DAYS} dias</h3>
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : agenda.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada agendado.</p>
              ) : (
                <Agenda events={agenda} onOpen={onOpenReminder} />
              )}
            </section>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
