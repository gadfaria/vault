import { lazy } from 'react'
import { HeartPulseIcon } from 'lucide-react'
import type { VaultModule } from '..'

export const health: VaultModule = {
  id: 'health',
  name: 'Saúde',
  icon: HeartPulseIcon,
  // Downloaded on first visit, to keep it out of the first load.
  Screen: lazy(() => import('./HealthScreen').then((m) => ({ default: m.HealthScreen }))),
}
