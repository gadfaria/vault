import type { Syncable } from '@/domain/types'

/**
 * A camera streamed by a go2rtc bridge running at home (see bridge/README.md).
 * The camera's own password stays in the bridge config and never reaches Drive.
 */
export interface Camera extends Syncable {
  name: string
  /** Bridge address, e.g. https://cam.example.com */
  bridgeUrl: string
  /** Stream name in the bridge's go2rtc.yaml */
  stream: string
}

export type CamerasData = {
  cameras: Camera[]
}

/** go2rtc's own player page, which picks WebRTC or MSE on its own. */
export function playerUrl(camera: Pick<Camera, 'bridgeUrl' | 'stream'>): string {
  const base = camera.bridgeUrl.replace(/\/+$/, '')
  return `${base}/stream.html?src=${encodeURIComponent(camera.stream)}`
}
