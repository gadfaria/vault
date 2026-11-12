import { useEffect, useRef, useState } from 'react'
import { CheckIcon, InfoIcon, MinusIcon, PlusIcon, TimerIcon } from 'lucide-react'
import { PageBody } from '@/components/app-layout'
import { SiteHeader } from '@/components/site-header'
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
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/format'
import { navigate } from '@/lib/navigate'
import { ExerciseInfoDialog } from './ExerciseInfo'
import { exerciseName, findExercise, type Exercise } from './exercises'
import {
  countedSets,
  formatClock,
  formatDuration,
  formatSet,
  lastPerformance,
  parseWeight,
  sessionSeconds,
  sessionSetCount,
  summarizeBlocks,
  targetReps,
} from './logic'
import { SET_KINDS, type SessionExercise, type SetLog, type WorkoutSession } from './types'
import type { Workout } from './useWorkout'

/**
 * One session: in progress (sets are ticked as they are done, with a rest timer)
 * or finished (opened from the history, still editable).
 */
export function SessionScreen({ session, workout }: { session: WorkoutSession; workout: Workout }) {
  // The screen owns the session while it is open: typing is never overwritten by a save coming back.
  const [draft, setDraft] = useState(session)
  const [unsaved, setUnsaved] = useState(false)
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<'finish' | 'delete' | null>(null)
  const [info, setInfo] = useState<Exercise | null>(null)
  const saveSeq = useRef(0)

  const inProgress = !draft.finishedAt
  const done = sessionSetCount(draft)
  const total = draft.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)

  /** Shows the change right away and sends it to Drive; only the latest save decides the "unsaved" warning. */
  async function persist(next: WorkoutSession): Promise<boolean> {
    setDraft(next)
    const seq = ++saveSeq.current
    const ok = await workout.saveSession(next)
    if (seq === saveSeq.current) setUnsaved(!ok)
    return ok
  }

  function withExercise(index: number, change: (exercise: SessionExercise) => SessionExercise): WorkoutSession {
    return { ...draft, exercises: draft.exercises.map((exercise, i) => (i === index ? change(exercise) : exercise)) }
  }

  function updateSet(exerciseIndex: number, setIndex: number, next: SetLog) {
    const before = draft.exercises[exerciseIndex].sets[setIndex]
    if (inProgress && next.done && !before.done) {
      setRestEndsAt(next.restSeconds > 0 ? Date.now() + next.restSeconds * 1000 : null)
    }
    void persist(withExercise(exerciseIndex, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === setIndex ? next : s)) })))
  }

  function addSet(exerciseIndex: number) {
    void persist(
      withExercise(exerciseIndex, (e) => {
        const last: SetLog = e.sets[e.sets.length - 1] ?? { kind: 'work', target: '', restSeconds: 0, weight: 0, reps: 0, done: false }
        return { ...e, sets: [...e.sets, { ...last, done: false }] }
      }),
    )
  }

  function removeSet(exerciseIndex: number) {
    void persist(withExercise(exerciseIndex, (e) => ({ ...e, sets: e.sets.slice(0, -1) })))
  }

  async function finish() {
    setRestEndsAt(null)
    if (await persist({ ...draft, finishedAt: new Date().toISOString() })) navigate('#/workout')
    // Not saved: it stays in progress here too, so the screen matches what Drive has.
    else setDraft((current) => ({ ...current, finishedAt: '' }))
  }

  async function remove() {
    if (await workout.deleteSession(draft)) navigate('#/workout')
  }

  const seconds = sessionSeconds(draft)

  return (
    <>
      <SiteHeader title={[{ label: 'Treino', href: '#/workout' }, { label: draft.routineName }]}>
        {inProgress && (
          <Button size="sm" onClick={() => setConfirm('finish')}>
            <CheckIcon />
            Finalizar
          </Button>
        )}
      </SiteHeader>

      <PageBody>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6">
          <p className="text-sm text-muted-foreground">
            {formatDate(draft.date, { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}
            {inProgress ? <Elapsed since={draft.startedAt} /> : seconds !== null && formatDuration(seconds)}
            {' · '}
            <span className="tabular-nums">
              {done}/{total} séries
            </span>
          </p>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirm('delete')}>
            {inProgress ? 'Descartar' : 'Excluir'}
          </Button>
        </div>

        {unsaved && (
          <div className="mx-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm lg:mx-6">
            <span>A última alteração não foi salva no Drive.</span>
            <Button variant="outline" size="sm" onClick={() => void persist(draft)}>
              Tentar de novo
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @4xl/main:grid-cols-2">
          {draft.exercises.map((exercise, exerciseIndex) => {
            const catalog = findExercise(exercise.exerciseId)
            const previous = countedSets(lastPerformance(workout.sessions, exercise.exerciseId, draft))
            const timed = catalog?.unit === 'seconds'
            return (
              <Card key={exerciseIndex}>
                <CardHeader>
                  <CardTitle>{exerciseName(exercise.exerciseId)}</CardTitle>
                  <CardDescription>
                    {[summarizeBlocks(plannedBlocks(exercise.sets), catalog?.unit), exercise.notes].filter(Boolean).join(' · ')}
                  </CardDescription>
                  {catalog && (
                    <CardAction>
                      <Button variant="ghost" size="icon" onClick={() => setInfo(catalog)} aria-label="Como fazer">
                        <InfoIcon />
                      </Button>
                    </CardAction>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    {previous.length
                      ? `Última vez: ${previous.map((s) => formatSet(s, catalog?.unit)).join(' · ')}`
                      : 'Primeira vez neste exercício'}
                  </p>
                  <div className="grid grid-cols-[1.5rem_1fr_1fr_2.5rem] items-center gap-2 text-xs text-muted-foreground">
                    <span />
                    <span>Carga (kg)</span>
                    <span>{timed ? 'Tempo (s)' : 'Repetições'}</span>
                    <span />
                  </div>
                  {exercise.sets.map((set, setIndex) => (
                    <SetRow
                      key={setIndex}
                      label={setLabel(exercise.sets, setIndex)}
                      set={set}
                      onChange={(next) => updateSet(exerciseIndex, setIndex, next)}
                    />
                  ))}
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => addSet(exerciseIndex)}>
                      <PlusIcon />
                      Série
                    </Button>
                    {exercise.sets.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeSet(exerciseIndex)}>
                        <MinusIcon />
                        Série
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {restEndsAt !== null && (
          <RestBar
            endsAt={restEndsAt}
            onExtend={() => setRestEndsAt((endsAt) => (endsAt ?? Date.now()) + 15_000)}
            onDone={() => setRestEndsAt(null)}
          />
        )}
      </PageBody>

      <ExerciseInfoDialog exercise={info} onClose={() => setInfo(null)} />

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'finish' ? 'Finalizar treino?' : inProgress ? 'Descartar treino?' : 'Excluir treino?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'finish'
                ? done === total
                  ? `Todas as ${total} séries foram feitas.`
                  : `${done} de ${total} séries feitas. As não marcadas ficam fora do histórico.`
                : `${draft.routineName} de ${formatDate(draft.date)} será removido do histórico.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {confirm === 'finish' ? (
              <AlertDialogAction onClick={() => void finish()}>Finalizar</AlertDialogAction>
            ) : (
              <AlertDialogAction variant="destructive" onClick={() => void remove()}>
                {inProgress ? 'Descartar' : 'Excluir'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Consecutive sets with the same kind and target, back as the blocks they were planned in. */
function plannedBlocks(sets: SetLog[]): { sets: number; reps: string }[] {
  const blocks: { kind: string; sets: number; reps: string }[] = []
  for (const set of sets) {
    const last = blocks[blocks.length - 1]
    if (last && last.kind === set.kind && last.reps === set.target) last.sets += 1
    else blocks.push({ kind: set.kind, sets: 1, reps: set.target })
  }
  return blocks
}

/** What the row shows before the inputs: "A" for warm-up, "P" for preparatory, the number among work sets. */
function setLabel(sets: SetLog[], index: number): { short: string; long: string } {
  const set = sets[index]
  if (set.kind === 'warmup') return { short: 'A', long: SET_KINDS.warmup }
  if (set.kind === 'prep') return { short: 'P', long: SET_KINDS.prep }
  const number = sets.slice(0, index + 1).filter((s) => s.kind === 'work').length
  return { short: String(number), long: `Série ${number}` }
}

/** One set: load and reps are committed on blur, the button ticks it as done (committing what is typed). */
function SetRow({
  label,
  set,
  onChange,
}: {
  label: { short: string; long: string }
  set: SetLog
  onChange: (next: SetLog) => void
}) {
  const [weight, setWeight] = useState(set.weight ? String(set.weight).replace('.', ',') : '')
  const [reps, setReps] = useState(set.reps ? String(set.reps) : '')

  function typed(): SetLog {
    return { ...set, weight: parseWeight(weight) ?? 0, reps: Number.parseInt(reps, 10) || 0 }
  }

  function commit() {
    const next = typed()
    if (next.weight !== set.weight || next.reps !== set.reps) onChange(next)
  }

  /** Ticking a set with no reps typed records the lowest number of the target ("6-9" → 6). */
  function toggle() {
    const next = typed()
    if (!set.done && next.reps === 0) {
      next.reps = targetReps(set.target)
      if (next.reps) setReps(String(next.reps))
    }
    onChange({ ...next, done: !set.done })
  }

  return (
    <div className="grid grid-cols-[1.5rem_1fr_1fr_2.5rem] items-center gap-2">
      <span
        className={`text-center text-sm tabular-nums ${set.kind === 'work' ? 'font-medium' : 'text-muted-foreground'}`}
        title={label.long}
      >
        {label.short}
      </span>
      <Input
        className="h-10 text-base tabular-nums"
        inputMode="decimal"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={commit}
        onFocus={(e) => e.target.select()}
        placeholder="—"
        aria-label={`Carga · ${label.long}`}
      />
      <Input
        className="h-10 text-base tabular-nums"
        inputMode="numeric"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={commit}
        onFocus={(e) => e.target.select()}
        placeholder={set.target || '—'}
        aria-label={`Repetições · ${label.long}`}
      />
      <Button
        variant={set.done ? 'default' : 'outline'}
        size="icon"
        className="size-10"
        onClick={toggle}
        aria-pressed={set.done}
        aria-label={set.done ? `Desmarcar · ${label.long}` : `Concluir · ${label.long}`}
      >
        <CheckIcon />
      </Button>
    </div>
  )
}

/** Time since the session started, refreshed twice a minute. */
function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return <>{formatDuration((now - new Date(since).getTime()) / 1000)}</>
}

/** Countdown stuck to the bottom of the page. It follows the clock, so it stays right after the tab sleeps. */
function RestBar({ endsAt, onExtend, onDone }: { endsAt: number; onExtend: () => void; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  const remaining = (endsAt - now) / 1000

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (remaining > 0) return
    navigator.vibrate?.([200, 100, 200])
    onDone()
  }, [remaining, onDone])

  return (
    <div className="sticky bottom-0 z-40 mt-auto flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border bg-background px-4 py-2.5 shadow-lg">
        <TimerIcon className="size-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Descanso</span>
        <span className="text-xl font-semibold tabular-nums">{formatClock(remaining)}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onExtend}>
            +15s
          </Button>
          <Button size="sm" onClick={onDone}>
            Pular
          </Button>
        </div>
      </div>
    </div>
  )
}
