import { lazy } from 'react'
import { LandmarkIcon } from 'lucide-react'
import type { VaultModule } from '..'

export const finance: VaultModule = {
  id: 'finance',
  name: 'Finanças',
  icon: LandmarkIcon,
  // Downloaded on first visit, to keep it out of the first load.
  Screen: lazy(() => import('./FinanceScreen').then((m) => ({ default: m.FinanceScreen }))),
}
