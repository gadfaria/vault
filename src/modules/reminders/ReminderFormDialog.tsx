import { useState, type FormEvent } from 'react'
import { Field } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { parseDate, today } from '@/lib/format'
import { CheckIcon } from 'lucide-react'
import { FREQUENCIES, LEAD_OPTIONS, REMINDER_COLORS, WEEKDAYS, type Reminder, type ReminderColor, type ReminderFrequency } from './types'
import type { ReminderInput } from './useReminders'

interface ReminderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reminder?: Reminder
  /** YYYY-MM-DD a new reminder starts on, today when not given */
  date?: string
  onSubmit: (input: ReminderInput) => Promise<boolean>
  onDelete?: (reminder: Reminder) => void
}

export function ReminderFormDialog(props: ReminderFormDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {props.open && <ReminderForm key={props.reminder?.id ?? 'new'} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function ReminderForm({ reminder, date, onSubmit, onOpenChange, onDelete }: ReminderFormDialogProps) {
  const [title, setTitle] = useState(reminder?.title ?? '')
  const [frequency, setFrequency] = useState<ReminderFrequency>(reminder?.frequency ?? 'once')
  const [startDate, setStartDate] = useState(reminder?.startDate ?? date ?? today())
  const [endDate, setEndDate] = useState(reminder?.endDate ?? '')
  const [every, setEvery] = useState(String(reminder?.interval ?? 1))
  const [weekdays, setWeekdays] = useState<number[]>(reminder?.weekdays ?? [])
  const [leadDays, setLeadDays] = useState(String(reminder?.leadDays ?? 0))
  const [notes, setNotes] = useState(reminder?.notes ?? '')
  const [color, setColor] = useState<ReminderColor | ''>(reminder?.color ?? '')
  const [pending, setPending] = useState(false)

  const step = Math.round(Number(every))
  const repeats = frequency !== 'once'
  const valid =
    title.trim() !== '' &&
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    (endDate === '' || endDate >= startDate) &&
    (!repeats || step >= 1) &&
    (frequency !== 'weekly' || weekdays.length > 0)

  function changeFrequency(next: ReminderFrequency) {
    setFrequency(next)
    // Start from the chosen date's weekday, the usual pick.
    if (next === 'weekly' && weekdays.length === 0 && startDate) setWeekdays([parseDate(startDate).getDay()])
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    setPending(true)
    const ok = await onSubmit({
      title: title.trim(),
      frequency,
      startDate,
      endDate,
      interval: repeats ? step : 1,
      weekdays: frequency === 'weekly' ? weekdays : [],
      leadDays: Number(leadDays),
      notes: notes.trim(),
      color,
    })
    setPending(false)
    if (ok) onOpenChange(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{reminder ? 'Editar lembrete' : 'Novo lembrete'}</DialogTitle>
        <DialogDescription>
          Para o que não é conta nem assinatura: trocar o filtro, renovar um domínio, ligar para alguém…
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Lembrete" id="reminder-title" className="col-span-2">
          <Input
            id="reminder-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Trocar o filtro do ar-condicionado"
            autoFocus
          />
        </Field>
        <Field label="Repetição" id="reminder-frequency" className="col-span-2 sm:col-span-1">
          <Select value={frequency} onValueChange={(v) => changeFrequency(v as ReminderFrequency)}>
            <SelectTrigger id="reminder-frequency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FREQUENCIES).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Avisar" id="reminder-lead" className="col-span-2 sm:col-span-1">
          <Select value={leadDays} onValueChange={setLeadDays}>
            <SelectTrigger id="reminder-lead" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LEAD_OPTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={repeats ? 'Começa em' : 'Data'} id="reminder-start">
          <Input id="reminder-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        {/* Repeating: stops repeating after it. One-time: the last day of a period, e.g. a trip. */}
        <Field label={repeats ? 'Termina em' : 'Até'} optional id="reminder-end">
          <Input
            id="reminder-end"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-invalid={endDate !== '' && endDate < startDate}
          />
        </Field>
        {repeats && (
          <Field label="Repetir a cada" id="reminder-interval" className="col-span-2">
            <div className="flex items-center gap-2">
              <Input
                id="reminder-interval"
                value={every}
                onChange={(e) => setEvery(e.target.value)}
                inputMode="numeric"
                className="w-16 tabular-nums"
              />
              <span className="text-sm text-muted-foreground">{FREQUENCIES[frequency].unit[step === 1 ? 0 : 1]}</span>
            </div>
          </Field>
        )}
        {frequency === 'weekly' && (
          <Field label="Dias da semana" id="reminder-weekdays" className="col-span-2">
            <ToggleGroup
              id="reminder-weekdays"
              type="multiple"
              variant="outline"
              spacing={0}
              value={weekdays.map(String)}
              onValueChange={(values) => setWeekdays(values.map(Number))}
            >
              {WEEKDAYS.map((label, day) => (
                <ToggleGroupItem key={day} value={String(day)} className="px-2.5">
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        )}
        <Field label="Cor no calendário" optional id="reminder-color" className="col-span-2">
          <div id="reminder-color" role="radiogroup" className="flex flex-wrap gap-2">
            <ColorSwatch label="Sem cor" selected={color === ''} onSelect={() => setColor('')} className="border-2 border-dashed bg-transparent" />
            {Object.entries(REMINDER_COLORS).map(([value, { label, dot }]) => (
              <ColorSwatch key={value} label={label} selected={color === value} onSelect={() => setColor(value as ReminderColor)} className={dot} />
            ))}
          </div>
        </Field>
        <Field label="Observações" optional id="reminder-notes" className="col-span-2">
          <Textarea id="reminder-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>

      <DialogFooter className="sm:justify-between">
        {reminder && onDelete ? (
          <Button type="button" variant="ghost" onClick={() => onDelete(reminder)} disabled={pending}>
            Excluir lembrete
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending || !valid}>
          {pending ? 'Salvando…' : reminder ? 'Salvar' : 'Adicionar'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function ColorSwatch({ label, selected, onSelect, className }: { label: string; selected: boolean; onSelect: () => void; className: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className={`flex size-7 items-center justify-center rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? 'ring-2 ring-foreground' : ''
      } ${className}`}
    >
      {selected && <CheckIcon className="size-3.5 text-white mix-blend-difference" />}
    </button>
  )
}
