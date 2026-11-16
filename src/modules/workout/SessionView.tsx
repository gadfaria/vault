import { useState } from 'react'
import { InfoIcon } from 'lucide-react'
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
import { formatDate } from '@/lib/format'
import { navigate } from '@/lib/navigate'
import { ExerciseInfoDialog } from './ExerciseInfo'
import { exerciseName, findExercise, type Exercise } from './exercises'
import { formatDuration, formatSet, sessionSeconds, sessionSetCount, sessionVolume, setLabel } from './logic'
import type { WorkoutSession } from './types'
import type { Workout } from './useWorkout'

/** A finished session, opened from the history: what was done in each exercise. Nothing is editable; it can only be deleted. */
export function SessionView({ session, workout }: { session: WorkoutSession; workout: Workout }) {
  const [confirming, setConfirming] = useState(false)
  const [info, setInfo] = useState<Exercise | null>(null)

  const seconds = sessionSeconds(session)
  const volume = sessionVolume(session)

  async function remove() {
    if (await workout.deleteSession(session)) navigate('#/workout/history')
  }

  return (
    <>
      <SiteHeader
        title={[
          { label: 'Treino', href: '#/workout' },
          { label: 'Histórico', href: '#/workout/history' },
          { label: session.routineName },
        ]}
      />

      <PageBody>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6">
          <p className="text-sm text-muted-foreground">
            {[
              formatDate(session.date, { weekday: 'long', day: 'numeric', month: 'long' }),
              seconds !== null && formatDuration(seconds),
              `${sessionSetCount(session)} séries`,
              volume > 0 && `${volume.toLocaleString('pt-BR')} kg`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirming(true)}>
            Excluir
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @4xl/main:grid-cols-2">
          {session.exercises.map((exercise, exerciseIndex) => {
            const catalog = findExercise(exercise.exerciseId)
            // Sets left unticked were not done, so they stay out, but the others keep their original labels.
            const rows = exercise.sets
              .map((set, index) => ({ set, label: setLabel(exercise.sets, index) }))
              .filter(({ set }) => set.done)
            return (
              <Card key={exerciseIndex}>
                <CardHeader>
                  <CardTitle>{exerciseName(exercise.exerciseId)}</CardTitle>
                  {exercise.notes && <CardDescription>{exercise.notes}</CardDescription>}
                  {catalog && (
                    <CardAction>
                      <Button variant="ghost" size="icon" onClick={() => setInfo(catalog)} aria-label="Como fazer">
                        <InfoIcon />
                      </Button>
                    </CardAction>
                  )}
                </CardHeader>
                <CardContent>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Não feito neste treino.</p>
                  ) : (
                    <ul className="flex flex-col divide-y text-sm">
                      {rows.map(({ set, label }, i) => (
                        <li key={i} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                          <span
                            className={`w-6 text-center tabular-nums ${set.kind === 'work' ? 'font-medium' : 'text-muted-foreground'}`}
                            title={label.long}
                          >
                            {label.short}
                          </span>
                          <span className="tabular-nums">{formatSet(set, catalog?.unit)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </PageBody>

      <ExerciseInfoDialog exercise={info} onClose={() => setInfo(null)} />

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir treino?</AlertDialogTitle>
            <AlertDialogDescription>
              {session.routineName} de {formatDate(session.date)} será removido do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
