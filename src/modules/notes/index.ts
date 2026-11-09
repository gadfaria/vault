import { lazy } from 'react'
import { NotebookPenIcon } from 'lucide-react'
import type { VaultModule } from '..'

export const notes: VaultModule = {
  id: 'notes',
  name: 'Notas',
  icon: NotebookPenIcon,
  // Downloaded on first visit, to keep it out of the first load.
  Screen: lazy(() => import('./NotesScreen').then((m) => ({ default: m.NotesScreen }))),
}
