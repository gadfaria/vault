import { lazy } from 'react'
import { ReceiptTextIcon } from 'lucide-react'
import type { VaultModule } from '..'

export const bills: VaultModule = {
  id: 'bills',
  name: 'Contas',
  icon: ReceiptTextIcon,
  // Downloaded on first visit, to keep it out of the first load.
  Screen: lazy(() => import('./BillsModuleScreen').then((m) => ({ default: m.BillsModuleScreen }))),
}
