import { lazy } from 'react'
import { BellIcon } from 'lucide-react'
import type { VaultModule } from '..'

export const reminders: VaultModule = {
  id: 'reminders',
  name: 'Lembretes',
  icon: BellIcon,
  // Downloaded on first visit, to keep it out of the first load.
  Screen: lazy(() => import('./RemindersScreen').then((m) => ({ default: m.RemindersScreen }))),
}
