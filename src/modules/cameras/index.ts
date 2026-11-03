import { VideoIcon } from 'lucide-react'
import type { VaultModule } from '..'
import { CamerasScreen } from './CamerasScreen'

export const cameras: VaultModule = {
  id: 'cameras',
  name: 'Câmeras',
  icon: VideoIcon,
  Screen: CamerasScreen,
}
