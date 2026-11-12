import { useState } from 'react'
import { DumbbellIcon, PencilIcon, PlayIcon, PlusIcon } from 'lucide-react'
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
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { daysUntil, formatDate } from '@/lib/format'
import { navigate } from '@/lib/navigate'
import type { ModuleScreenProps } from '..'
import { ExerciseDetail, ExercisesPanel } from './ExercisesPanel'
import { exerciseName, findExercise } from './exercises'
import { formatDuration, sessionSeconds, sessionSetCount, sessionsThisWeek, sessionVolume, summarizeBlocks } from './logic'
import { RoutineFormDialog } from './RoutineFormDialog'
import { SessionScreen } from './SessionScreen'
import type { Routine, RoutineBlock, WorkoutSession } from './types'
import { useWorkout, type Workout } from './useWorkout'

const TABS = { routines: 'Treinos', history: 'Histórico', exercises: 'Exercícios' } as const

type Tab = keyof typeof TABS

export function WorkoutScreen({ path }: ModuleScreenProps) {
  const workout = useWorkout()
  const [section, id] = path

  if (section === 'session' && id) {
    const session = workout.sessions.find((s) => s.id === id)
    if (session) return <SessionScreen key={session.id} session={session} workout={workout} />
    if (workout.loading) return <LoadingPage />
  }

  if (section === 'exercises' && id) {
    const exercise = findExercise(id)
    if (exercise) return <ExerciseDetail exercise={exercise} workout={workout} />
  }

  const tab: Tab = section === 'history' || section === 'exercises' ? section : 'routines'

  return (
    <>
      <SiteHeader title="Treino" />
      <PageBody>
        <div className="px-4 lg:px-6">
          <Tabs value={tab} onValueChange={(value) => navigate(value === 'routines' ? '#/workout' : `#/workout/${value}`)}>
            <TabsList>
              {(Object.keys(TABS) as Tab[]).map((key) => (
                <TabsTrigger key={key} value={key}>
                  {TABS[key]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {tab === 'routines' && <RoutinesPanel workout={workout} />}
        {tab === 'history' && <HistoryTable loading={workout.loading} sessions={workout.sessions.filter((s) => s.finishedAt)} />}
        {tab === 'exercises' && <ExercisesPanel workout={workout} />}
      </PageBody>
    </>
  )
}

function LoadingPage() {
  return (
    <>
      <SiteHeader title="Treino" />
      <PageBody>
        <div className="flex flex-col gap-4 px-4 lg:px-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </PageBody>
    </>
  )
}

/** The work blocks of an exercise, or all of them when none is marked as work. */
function countedBlocks(blocks: RoutineBlock[]): RoutineBlock[] {
  const work = blocks.filter((block) => block.kind === 'work')
  return work.length ? work : blocks
}

function relativeDay(isoDate: string): string {
  const days = -daysUntil(isoDate)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

function RoutinesPanel({ workout }: { workout: Workout }) {
  const [dialog, setDialog] = useState<{ routine?: Routine } | null>(null)
  const [deleting, setDeleting] = useState<Routine | null>(null)
  const [starting, setStarting] = useState<string | null>(null)

  const finished = workout.sessions.filter((s) => s.finishedAt)
  const last = finished[0]
  const { active } = workout

  async function start(routine: Routine) {
    setStarting(routine.id)
    const session = await workout.startSession(routine)
    setStarting(null)
    if (session) navigate(`#/workout/session/${session.id}`)
  }

  return (
    <>
      {active && (
        <div className="px-4 lg:px-6">
          <Card className="border-primary/40">
            <CardHeader>
              <CardDescription>Treino em andamento</CardDescription>
              <CardTitle>{active.routineName}</CardTitle>
              <CardAction>
                <Button asChild>
                  <a href={`#/workout/session/${active.id}`}>
                    <PlayIcon />
                    Continuar
                  </a>
                </Button>
              </CardAction>
            </CardHeader>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 dark:*:data-[slot=card]:bg-card">
        <StatCard
          loading={workout.loading}
          label="Nesta semana"
          value={String(sessionsThisWeek(finished))}
          detail="desde segunda"
        />
        <StatCard
          loading={workout.loading}
          label="Último treino"
          value={last ? relativeDay(last.date) : '—'}
          detail={last ? last.routineName : 'Nenhum ainda'}
        />
        <StatCard loading={workout.loading} label="Total" value={String(finished.length)} detail="treinos" />
      </div>

      <div className="flex items-center justify-between px-4 lg:px-6">
        <h2 className="text-sm font-medium">Seus treinos</h2>
        <Button variant="outline" size="sm" onClick={() => setDialog({})} disabled={workout.loading}>
          <PlusIcon />
          Novo treino
        </Button>
      </div>

      <div className="px-4 lg:px-6">
        {workout.loading ? (
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : workout.routines.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
            <DumbbellIcon className="size-6 text-muted-foreground" />
            <p className="text-sm">Nenhum treino ainda</p>
            <p className="text-sm text-muted-foreground">Monte o primeiro treino com os exercícios, séries e descanso.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
            {workout.routines.map((routine) => {
              const lastDone = finished.find((s) => s.routineId === routine.id)
              return (
                <Card key={routine.id}>
                  <CardHeader>
                    <CardTitle>{routine.name}</CardTitle>
                    <CardDescription>
                      {lastDone ? `Feito ${relativeDay(lastDone.date)}` : 'Ainda não feito'}
                    </CardDescription>
                    <CardAction>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDialog({ routine })}
                        aria-label={`Editar ${routine.name}`}
                      >
                        <PencilIcon />
                      </Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="flex flex-col gap-1 text-sm">
                      {routine.items.map((item, i) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span className="truncate">{exerciseName(item.exerciseId)}</span>
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            {summarizeBlocks(countedBlocks(item.blocks), findExercise(item.exerciseId)?.unit)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {routine.notes && <p className="mt-3 whitespace-pre-line text-xs text-muted-foreground">{routine.notes}</p>}
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() => void start(routine)}
                      disabled={starting !== null || active !== undefined}
                    >
                      <PlayIcon />
                      {starting === routine.id ? 'Iniciando…' : 'Iniciar'}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <RoutineFormDialog
        open={dialog !== null && deleting === null}
        onOpenChange={(open) => !open && setDialog(null)}
        routine={dialog?.routine}
        onSubmit={(input) => workout.saveRoutine(input, dialog?.routine)}
        onDelete={setDeleting}
      />
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir treino?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name} será removido. As sessões já feitas continuam no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deleting && (await workout.deleteRoutine(deleting))) setDialog(null)
                setDeleting(null)
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Compact on purpose: three fit side by side on a phone, so the routines stay near the top. */
function StatCard({ loading, label, value, detail }: { loading: boolean; label: string; value: string; detail: string }) {
  return (
    <Card className="gap-1 py-3">
      <CardHeader className="gap-0.5 px-3">
        <CardDescription className="truncate text-xs">{label}</CardDescription>
        <CardTitle className="truncate text-xl font-semibold tabular-nums">
          {loading ? <Skeleton className="h-7 w-12" /> : value}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 text-xs text-muted-foreground">
        {loading ? <Skeleton className="h-4 w-20" /> : <span className="line-clamp-1">{detail}</span>}
      </CardContent>
    </Card>
  )
}

function HistoryTable({ loading, sessions }: { loading: boolean; sessions: WorkoutSession[] }) {
  return (
    <div className="px-4 lg:px-6">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="pl-4">Data</TableHead>
              <TableHead>Treino</TableHead>
              <TableHead className="hidden sm:table-cell">Duração</TableHead>
              <TableHead className="text-right">Séries</TableHead>
              <TableHead className="hidden pr-4 text-right md:table-cell">Volume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="px-4">
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Nenhum treino finalizado ainda.
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => {
                const seconds = sessionSeconds(session)
                const volume = sessionVolume(session)
                return (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`#/workout/session/${session.id}`)}
                  >
                    <TableCell className="pl-4 text-muted-foreground tabular-nums">{formatDate(session.date)}</TableCell>
                    <TableCell className="max-w-56 truncate font-medium">{session.routineName}</TableCell>
                    <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                      {seconds !== null ? formatDuration(seconds) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{sessionSetCount(session)}</TableCell>
                    <TableCell className="hidden pr-4 text-right tabular-nums md:table-cell">
                      {volume > 0 ? `${volume.toLocaleString('pt-BR')} kg` : '—'}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
