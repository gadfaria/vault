import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MUSCLE_GROUPS, type Exercise } from './exercises'

/** Loops through the exercise's frames like a GIF; renders nothing when it has none. */
export function ExerciseMedia({ exercise, className }: { exercise: Exercise; className?: string }) {
  const frames = exercise.frames ?? []
  const [index, setIndex] = useState(0)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    if (frames.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % frames.length), 900)
    return () => clearInterval(timer)
  }, [frames.length])

  // A missing photo hides the picture instead of showing a broken image.
  if (frames.length === 0 || broken) return null
  return (
    <img
      src={frames[index % frames.length]}
      alt={`Demonstração: ${exercise.name}`}
      onError={() => setBroken(true)}
      width={480}
      height={320}
      className={`aspect-[3/2] w-full rounded-lg border bg-muted object-cover ${className ?? ''}`}
    />
  )
}

/** The description as numbered steps (one per line in the catalog). */
export function ExerciseSteps({ exercise }: { exercise: Exercise }) {
  return (
    <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
      {exercise.description.split('\n').map((step, i) => (
        <li key={i}>{step}</li>
      ))}
    </ol>
  )
}

export function ExerciseInfoDialog({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  return (
    <Dialog open={exercise !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        {exercise && (
          <>
            <DialogHeader>
              <DialogTitle>{exercise.name}</DialogTitle>
              <DialogDescription asChild>
                <div>
                  <Badge variant="outline">{MUSCLE_GROUPS[exercise.group]}</Badge>
                </div>
              </DialogDescription>
            </DialogHeader>
            <ExerciseMedia exercise={exercise} />
            <ExerciseSteps exercise={exercise} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
