import { lazy } from 'react'
import { IdCardIcon } from 'lucide-react'
import type { VaultModule } from '..'

export const documents: VaultModule = {
  id: 'documents',
  name: 'Documentos',
  icon: IdCardIcon,
  // Downloaded on first visit, to keep it out of the first load.
  Screen: lazy(() => import('./DocumentsScreen').then((m) => ({ default: m.DocumentsScreen }))),
}
