/**
 * Pins `progressOf` (`src/values/progress.ts`) — the one constructor of
 * progress percentages: integers within 0–100 only, everything else refused
 * (no clamping, no rounding — a corrected value would be a silent repair).
 */
import { describe, expect, it } from 'vitest'
import { progressOf } from '../../src/values/progress'

describe('progressOf', () => {
  it('accepts only integers already within 0–100', () => {
    expect(progressOf(0)).toBe(0)
    expect(progressOf(100)).toBe(100)
    expect(progressOf(55)).toBe(55)
    expect(progressOf(55.5)).toBeUndefined()
    expect(progressOf(-1)).toBeUndefined()
    expect(progressOf(101)).toBeUndefined()
    expect(progressOf(Number.NaN)).toBeUndefined()
  })

  it('refuses the non-finite values wholesale', () => {
    expect(progressOf(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(progressOf(Number.NEGATIVE_INFINITY)).toBeUndefined()
  })
})
