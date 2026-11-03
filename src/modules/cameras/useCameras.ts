import { useCallback, useMemo } from 'react'
import { newSyncable, touch } from '@/domain/merge'
import type { Syncable } from '@/domain/types'
import { useCollection } from '@/storage/useCollection'
import type { Camera, CamerasData } from './types'

const EMPTY: CamerasData = { cameras: [] }

export type CameraInput = Omit<Camera, keyof Syncable>

export function useCameras() {
  const { data, loading, save } = useCollection('cameras', EMPTY)

  const cameras = useMemo(
    () => (data?.cameras ?? []).filter((c) => !c.deleted).sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  )

  const createCamera = useCallback(
    (input: CameraInput) => save({ cameras: [{ ...newSyncable(), ...input }] }),
    [save],
  )

  const updateCamera = useCallback(
    (camera: Camera, input: CameraInput) => save({ cameras: [touch(camera, input)] }),
    [save],
  )

  const deleteCamera = useCallback(
    (camera: Camera) => save({ cameras: [touch(camera, { deleted: true })] }),
    [save],
  )

  return { cameras, loading, createCamera, updateCamera, deleteCamera }
}

export type CamerasState = ReturnType<typeof useCameras>
