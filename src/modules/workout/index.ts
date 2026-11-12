import { lazy } from 'react'
import { DumbbellIcon } from 'lucide-react'
import type { VaultModule } from '..'

export const workout: VaultModule = {
  id: 'workout',
  name: 'Treino',
  icon: DumbbellIcon,
  // Downloaded on first visit, to keep it out of the first load.
  Screen: lazy(() => import('./WorkoutScreen').then((m) => ({ default: m.WorkoutScreen }))),
}
