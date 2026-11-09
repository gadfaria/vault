import { lazy } from 'react'
import { CarIcon } from 'lucide-react'
import type { VaultModule } from '..'

export const vehicles: VaultModule = {
  id: 'vehicles',
  name: 'Veículos',
  icon: CarIcon,
  // Downloaded on first visit, to keep it out of the first load.
  Screen: lazy(() => import('./VehiclesScreen').then((m) => ({ default: m.VehiclesScreen }))),
}
