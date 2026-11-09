import { lazy } from 'react'
import { VideoIcon } from 'lucide-react'
import type { VaultModule } from '..'

export const cameras: VaultModule = {
  id: 'cameras',
  name: 'Câmeras',
  icon: VideoIcon,
  // Downloaded on first visit, to keep it out of the first load.
  Screen: lazy(() => import('./CamerasScreen').then((m) => ({ default: m.CamerasScreen }))),
}
