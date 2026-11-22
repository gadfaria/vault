import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ReminderDetailsDialog } from './ReminderDetailsDialog'
import { ReminderFormDialog } from './ReminderFormDialog'
import type { Reminder } from './types'
import type { ReminderRow, useReminders } from './useReminders'

type Confirm = { kind: 'end' | 'delete'; reminder: Reminder }
type Details = { reminderId: string; date?: string; done?: boolean }

/** The reminder dialogs (details, form, confirmation), shared by Lembretes and the calendar. */
export function useReminderDialogs(reminders: ReturnType<typeof useReminders>) {
  const [details, setDetails] = useState<Details | null>(null)
  // Kept apart from `details` so the content stays on screen while the dialog animates out.
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [form, setForm] = useState<{ reminder?: Reminder; date?: string } | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  async function complete(row: ReminderRow) {
    const done = await reminders.complete(row)
    if (done) toast.success(`${row.reminder.title}: feito`, { action: { label: 'Desfazer', onClick: () => reminders.undoOccurrence(done) } })
  }

  function showDetails(target: Details) {
    setDetails(target)
    setDetailsOpen(true)
  }

  function edit(reminder?: Reminder) {
    setDetailsOpen(false)
    setForm({ reminder })
  }

  /** Opens the form for a new reminder starting on `date` (YYYY-MM-DD). */
  function create(date: string) {
    setDetailsOpen(false)
    setForm({ date })
  }

  // Looked up on every render, so the dialog follows what gets saved.
  const shown = details ? reminders.all.find((r) => r.id === details.reminderId) : undefined

  const dialogs = (
    <>
      <ReminderDetailsDialog
        open={detailsOpen && confirm === null}
        reminder={shown}
        date={details?.date}
        done={details?.done}
        row={reminders.active.find((row) => row.reminder.id === details?.reminderId)}
        finished={reminders.finished.find((row) => row.reminder.id === details?.reminderId)}
        onClose={() => setDetailsOpen(false)}
        onComplete={complete}
        onEdit={edit}
      />
      <ReminderFormDialog
        open={form !== null && confirm === null}
        onOpenChange={(open) => !open && setForm(null)}
        reminder={form?.reminder}
        date={form?.date}
        onSubmit={(input) => reminders.saveReminder(input, form?.reminder)}
        onDelete={(reminder) => setConfirm({ kind: 'delete', reminder })}
      />
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === 'end' ? `Encerrar ${confirm.reminder.title}?` : 'Excluir lembrete?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'end'
                ? 'Ele para de repetir e vai para "Concluídos", de onde pode ser reativado.'
                : `${confirm?.reminder.title ?? ''} será removido de vez.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm?.kind === 'delete' ? 'destructive' : 'default'}
              onClick={async () => {
                if (confirm?.kind === 'end') await reminders.endReminder(confirm.reminder)
                if (confirm?.kind === 'delete' && (await reminders.deleteReminder(confirm.reminder))) {
                  setForm(null)
                  setDetailsOpen(false)
                }
                setConfirm(null)
              }}
            >
              {confirm?.kind === 'end' ? 'Encerrar' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  return { dialogs, complete, edit, create, showDetails, askToEnd: (reminder: Reminder) => setConfirm({ kind: 'end', reminder }), askToDelete: (reminder: Reminder) => setConfirm({ kind: 'delete', reminder }) }
}
