import { lazy } from 'react'
import { BookOpenIcon } from 'lucide-react'
import type { VaultModule } from '..'

export const reading: VaultModule = {
  id: 'reading',
  name: 'Leitura',
  icon: BookOpenIcon,
  // Downloaded on first visit, to keep it out of the first load.
  Screen: lazy(() => import('./ReadingScreen').then((m) => ({ default: m.ReadingScreen }))),
}
