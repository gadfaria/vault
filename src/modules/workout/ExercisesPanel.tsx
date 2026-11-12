import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { PageBody } from '@/components/app-layout'
import { SiteHeader } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatShortDate } from '@/lib/format'
import { ExerciseMedia, ExerciseSteps } from './ExerciseInfo'
import { EXERCISES, MUSCLE_GROUPS, type Exercise, type MuscleGroup } from './exercises'
import { formatSet, formatWeight, progressSeries } from './logic'
import type { Workout } from './useWorkout'

/** The fixed catalog, grouped by muscle, each exercise linking to its page. */
export function ExercisesPanel({ workout }: { workout: Workout }) {
  const groups = (Object.keys(MUSCLE_GROUPS) as MuscleGroup[])
    .map((group) => ({ group, exercises: EXERCISES.filter((e) => e.group === group) }))
    .filter((entry) => entry.exercises.length > 0)

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @3xl/main:grid-cols-2 @6xl/main:grid-cols-3">
      {groups.map(({ group, exercises }) => (
        <Card key={group}>
          <CardHeader>
            <CardTitle>{MUSCLE_GROUPS[group]}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {exercises.map((exercise) => {
                const series = progressSeries(workout.sessions, exercise.id)
                const latest = series[series.length - 1]
                return (
                  <li key={exercise.id}>
                    <a
                      href={`#/workout/exercises/${exercise.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm hover:underline"
                    >
                      <span className="truncate font-medium">{exercise.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {latest ? formatSet({ weight: latest.topWeight, reps: latest.topReps }, exercise.unit) : '—'}
                      </span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

const chartConfig = {
  value: { label: 'Maior carga', color: 'var(--primary)' },
} satisfies ChartConfig

/** One exercise: how to do it and how the load evolved. */
export function ExerciseDetail({ exercise, workout }: { exercise: Exercise; workout: Workout }) {
  const series = useMemo(() => progressSeries(workout.sessions, exercise.id), [workout.sessions, exercise.id])
  // Bodyweight exercises have no load to plot, so the chart follows the reps instead.
  const weighted = series.some((point) => point.topWeight > 0)
  const data = series.map((point) => ({ ...point, value: weighted ? point.topWeight : point.topReps }))
  const best = series.reduce((max, point) => Math.max(max, point.topWeight), 0)

  return (
    <>
      <SiteHeader
        title={[
          { label: 'Treino', href: '#/workout' },
          { label: 'Exercícios', href: '#/workout/exercises' },
          { label: exercise.name },
        ]}
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @4xl/main:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Como fazer</CardTitle>
              <CardDescription>
                <Badge variant="outline">{MUSCLE_GROUPS[exercise.group]}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ExerciseMedia exercise={exercise} />
              <ExerciseSteps exercise={exercise} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolução</CardTitle>
              <CardDescription>
                {workout.loading
                  ? ' '
                  : series.length === 0
                    ? 'Ainda sem registros'
                    : `${series.length} ${series.length === 1 ? 'dia' : 'dias'} de treino${best > 0 ? ` · recorde ${formatWeight(best)}` : ''}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              {workout.loading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : data.length < 2 ? (
                <div className="flex h-[220px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  Treine este exercício em dois dias diferentes para ver a evolução aqui.
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="fillLoad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      tickFormatter={(value: string) => formatShortDate(value)}
                    />
                    <YAxis hide domain={['dataMin - (dataMax - dataMin) * 0.2', 'auto']} />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_, payload) => {
                            const date = payload?.[0]?.payload?.date as string | undefined
                            return date ? formatDate(date, { day: '2-digit', month: 'long', year: 'numeric' }) : ''
                          }}
                          formatter={(value) => (
                            <div className="flex w-full items-center justify-between gap-4">
                              <span className="text-muted-foreground">{weighted ? 'Maior carga' : 'Repetições'}</span>
                              <span className="font-mono font-medium tabular-nums">
                                {weighted ? formatWeight(Number(value)) : String(value)}
                              </span>
                            </div>
                          )}
                          indicator="dot"
                        />
                      }
                    />
                    <Area dataKey="value" type="monotone" fill="url(#fillLoad)" stroke="var(--color-value)" />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {series.length > 0 && (
          <div className="px-4 lg:px-6">
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="pl-4">Data</TableHead>
                    <TableHead>Séries</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Volume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...series].reverse().map((point) => (
                    <TableRow key={point.date}>
                      <TableCell className="pl-4 text-muted-foreground tabular-nums">{formatDate(point.date)}</TableCell>
                      <TableCell className="whitespace-normal tabular-nums">
                        {point.sets.map((s) => formatSet(s, exercise.unit)).join(' · ')}
                      </TableCell>
                      <TableCell className="hidden pr-4 text-right tabular-nums sm:table-cell">
                        {point.volume > 0 ? `${point.volume.toLocaleString('pt-BR')} kg` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </PageBody>
    </>
  )
}
