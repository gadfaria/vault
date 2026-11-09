import { describe, expect, it } from 'vitest'
import { isInertType } from './safe-files'

describe('isInertType', () => {
  it('accepts images and PDFs, whatever the case or parameters', () => {
    expect(isInertType('image/png')).toBe(true)
    expect(isInertType('IMAGE/JPEG')).toBe(true)
    expect(isInertType('application/pdf; qs=0.9')).toBe(true)
  })

  it('refuses anything that can run a script, and unknown types', () => {
    expect(isInertType('image/svg+xml')).toBe(false)
    expect(isInertType('text/html')).toBe(false)
    expect(isInertType('application/xhtml+xml')).toBe(false)
    expect(isInertType('')).toBe(false)
  })
})
