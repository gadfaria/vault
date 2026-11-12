import { useState, type FormEvent } from 'react'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EXERCISES, MUSCLE_GROUPS, findExercise, type MuscleGroup } from './exercises'
import { SET_KINDS, type Routine, type SetKind } from './types'
import type { RoutineInput } from './useWorkout'

interface RoutineFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routine?: Routine
  onSubmit: (input: RoutineInput) => Promise<boolean>
  onDelete?: (routine: Routine) => void
}

/** Form rows: numbers stay as typed text until submit. */
interface BlockRow {
  key: string
  kind: SetKind
  sets: string
  reps: string
  rest: string
}

interface Row {
  key: string
  exerciseId: string
  notes: string
  blocks: BlockRow[]
}

const GROUPED = (Object.keys(MUSCLE_GROUPS) as MuscleGroup[])
  .map((group) => ({ group, exercises: EXERCISES.filter((e) => e.group === group) }))
  .filter((entry) => entry.exercises.length > 0)

function block(kind: SetKind, sets: string, reps: string, rest: string): BlockRow {
  return { key: crypto.randomUUID(), kind, sets, reps, rest }
}

/** A new exercise starts with one preparatory set and three work sets. */
function emptyRow(): Row {
  return {
    key: crypto.randomUUID(),
    exerciseId: '',
    notes: '',
    blocks: [block('prep', '1', '4-6', '60'), block('work', '3', '6-9', '120')],
  }
}

export function RoutineFormDialog(props: RoutineFormDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        {props.open && <RoutineForm key={props.routine?.id ?? 'new'} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function RoutineForm({ routine, onSubmit, onOpenChange, onDelete }: RoutineFormDialogProps) {
  const [name, setName] = useState(routine?.name ?? '')
  const [notes, setNotes] = useState(routine?.notes ?? '')
  const [rows, setRows] = useState<Row[]>(
    () =>
      routine?.items.map((item) => ({
        key: crypto.randomUUID(),
        exerciseId: item.exerciseId,
        notes: item.notes,
        blocks: item.blocks.map((b) => block(b.kind, String(b.sets), b.reps, String(b.restSeconds))),
      })) ?? [emptyRow()],
  )
  const [pending, setPending] = useState(false)

  const filled = rows.filter((row) => row.exerciseId)
  const valid = name.trim() !== '' && filled.length > 0

  const update = (key: string, changes: Partial<Row>) =>
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...changes } : row)))

  const updateBlock = (row: Row, blockKey: string, changes: Partial<BlockRow>) =>
    update(row.key, { blocks: row.blocks.map((b) => (b.key === blockKey ? { ...b, ...changes } : b)) })

  function move(index: number, by: number) {
    setRows((list) => {
      const target = index + by
      if (target < 0 || target >= list.length) return list
      const next = [...list]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    setPending(true)
    const ok = await onSubmit({
      name: name.trim(),
      notes: notes.trim(),
      items: filled.map((row) => ({
        exerciseId: row.exerciseId,
        notes: row.notes.trim(),
        blocks: row.blocks.map((b) => ({
          kind: b.kind,
          sets: Math.min(20, Math.max(1, Number.parseInt(b.sets, 10) || 1)),
          reps: b.reps.trim(),
          restSeconds: Math.max(0, Number.parseInt(b.rest, 10) || 0),
        })),
      })),
    })
    setPending(false)
    if (ok) onOpenChange(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{routine ? 'Editar treino' : 'Novo treino'}</DialogTitle>
        <DialogDescription>Os exercícios aparecem na sessão na ordem em que estão aqui.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <Field label="Nome" id="routine-name">
          <Input
            id="routine-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Push · Peito, ombro e tríceps"
            autoFocus={!routine}
          />
        </Field>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium">Exercícios</span>
          {rows.map((row, index) => (
            <div key={row.key} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-1">
                <Select value={row.exerciseId} onValueChange={(exerciseId) => update(row.key, { exerciseId })}>
                  <SelectTrigger className="min-w-0 flex-1" aria-label={`Exercício ${index + 1}`}>
                    <SelectValue placeholder="Escolha o exercício">
                      {/* Keeps the name readable when the id left the catalog. */}
                      {row.exerciseId ? (findExercise(row.exerciseId)?.name ?? 'Exercício removido') : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {GROUPED.map(({ group, exercises }) => (
                      <SelectGroup key={group}>
                        <SelectLabel>{MUSCLE_GROUPS[group]}</SelectLabel>
                        {exercises.map((exercise) => (
                          <SelectItem key={exercise.id} value={exercise.id}>
                            {exercise.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Mover para cima"
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  aria-label="Mover para baixo"
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                  disabled={rows.length === 1}
                  aria-label="Remover exercício"
                >
                  <XIcon />
                </Button>
              </div>

              <div className="grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_2rem] items-center gap-2 text-xs text-muted-foreground">
                <span>Tipo</span>
                <span>Séries</span>
                <span>Reps</span>
                <span>Descanso (s)</span>
                <span />
              </div>
              {row.blocks.map((b) => (
                <div
                  key={b.key}
                  className="grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_2rem] items-center gap-2"
                >
                  <Select value={b.kind} onValueChange={(kind) => updateBlock(row, b.key, { kind: kind as SetKind })}>
                    <SelectTrigger className="w-full min-w-0" aria-label="Tipo de série">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SET_KINDS) as SetKind[]).map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {SET_KINDS[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    inputMode="numeric"
                    value={b.sets}
                    onChange={(e) => updateBlock(row, b.key, { sets: e.target.value })}
                    aria-label="Séries"
                  />
                  <Input
                    value={b.reps}
                    onChange={(e) => updateBlock(row, b.key, { reps: e.target.value })}
                    placeholder="6-9"
                    aria-label="Repetições"
                  />
                  <Input
                    inputMode="numeric"
                    value={b.rest}
                    onChange={(e) => updateBlock(row, b.key, { rest: e.target.value })}
                    aria-label="Descanso em segundos"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => update(row.key, { blocks: row.blocks.filter((other) => other.key !== b.key) })}
                    disabled={row.blocks.length === 1}
                    aria-label="Remover bloco"
                  >
                    <XIcon />
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => update(row.key, { blocks: [...row.blocks, block('work', '3', '6-9', '120')] })}
                >
                  <PlusIcon />
                  Bloco de séries
                </Button>
              </div>

              <Input
                value={row.notes}
                onChange={(e) => update(row.key, { notes: e.target.value })}
                placeholder="Observação (opcional): pegada, banco, unilateral…"
                aria-label="Observação"
              />
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => setRows((list) => [...list, emptyRow()])}>
            <PlusIcon />
            Adicionar exercício
          </Button>
        </div>

        <Field label="Observações" optional id="routine-notes">
          <Textarea id="routine-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>

      <DialogFooter className="sm:justify-between">
        {routine && onDelete ? (
          <Button type="button" variant="ghost" onClick={() => onDelete(routine)} disabled={pending}>
            Excluir
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending || !valid}>
          {pending ? 'Salvando…' : routine ? 'Salvar' : 'Criar treino'}
        </Button>
      </DialogFooter>
    </form>
  )
}
