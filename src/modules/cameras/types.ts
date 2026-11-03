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
  /** Pan/tilt through the bridge's PTZ server (bridge/ptz-server.mjs). Missing on cameras saved before it existed. */
  ptz?: boolean
}

export type CamerasData = {
  cameras: Camera[]
}

/** go2rtc's player (WebRTC or MSE, picked on its own), or the bridge's player with arrows when the camera moves. */
export function playerUrl(camera: Pick<Camera, 'bridgeUrl' | 'stream' | 'ptz'>): string {
  const base = camera.bridgeUrl.replace(/\/+$/, '')
  const page = camera.ptz ? 'ptz/' : 'stream.html'
  return `${base}/${page}?src=${encodeURIComponent(camera.stream)}`
}
