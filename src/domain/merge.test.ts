import { describe, expect, it } from 'vitest'
import { mergeById } from './merge'
import type { Syncable } from './types'

const item = (id: string, updatedAt: string, deleted = false): Syncable => ({ id, createdAt: '2026-01-01T00:00:00.000Z', updatedAt, deleted })

describe('mergeById', () => {
  it('keeps the newest version of each item', () => {
    const remote = [item('a', '2026-01-02T00:00:00.000Z'), item('b', '2026-01-05T00:00:00.000Z')]
    const local = [item('a', '2026-01-03T00:00:00.000Z'), item('b', '2026-01-04T00:00:00.000Z')]
    expect(mergeById(remote, local).map((i) => i.updatedAt)).toEqual(['2026-01-03T00:00:00.000Z', '2026-01-05T00:00:00.000Z'])
  })

  it('adds items only one side has', () => {
    const merged = mergeById([item('a', '2026-01-01T00:00:00.000Z')], [item('b', '2026-01-01T00:00:00.000Z')])
    expect(merged.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('never brings a deleted item back from a stale copy', () => {
    const remote = [item('a', '2026-01-03T00:00:00.000Z', true)]
    const local = [item('a', '2026-01-02T00:00:00.000Z')]
    expect(mergeById(remote, local)[0].deleted).toBe(true)
  })

  it('keeps the remote version on a tie', () => {
    const remote = [{ ...item('a', '2026-01-01T00:00:00.000Z'), deleted: true }]
    const local = [item('a', '2026-01-01T00:00:00.000Z')]
    expect(mergeById(remote, local)[0].deleted).toBe(true)
  })
})
