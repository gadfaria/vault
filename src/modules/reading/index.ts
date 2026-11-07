import { BookOpenIcon } from 'lucide-react'
import type { VaultModule } from '..'
import { ReadingScreen } from './ReadingScreen'

export const reading: VaultModule = {
  id: 'reading',
  name: 'Leitura',
  icon: BookOpenIcon,
  Screen: ReadingScreen,
}
