/**
 * Pins the timeline geometry (`src/commons/time-scale.ts`) — pure
 * presentation: a LINEAR scale bounded to [8 %, 92 %], a middle position for
 * a degenerate scale, and staggering by geometry alone.
 */
import { describe, expect, it } from 'vitest'
import {
  LEFT_BOUND,
  MIN_GAP_PCT,
  RIGHT_BOUND,
  absoluteDay,
  needsStagger,
  positionPct,
  scaleOf,
  withinScale,
  type Scale,
} from '../../src/commons/time-scale'

describe('scaleOf', () => {
  it('no date → no scale', () => {
    expect(scaleOf([])).toBeUndefined()
  })

  it('min and max in days, whatever the input order', () => {
    const s = scaleOf(['2026-12-31', '2026-01-01', '2026-06-15'])
    expect(s).toEqual({ min: absoluteDay('2026-01-01'), max: absoluteDay('2026-12-31') })
  })

  it('absoluteDay guards an unparsable date to 0 rather than NaN', () => {
    expect(absoluteDay('garbage')).toBe(0)
  })
})

describe('positionPct', () => {
  const s = scaleOf(['2026-01-01', '2026-12-31']) as Scale

  it('degenerate scale (a single date) → the middle, 50 %', () => {
    const lone = scaleOf(['2026-05-01']) as Scale
    expect(positionPct('2026-05-01', lone)).toBe(50)
  })

  it('projects the extremes onto the 8 / 92 bounds', () => {
    expect(positionPct('2026-01-01', s)).toBe(LEFT_BOUND)
    expect(positionPct('2026-12-31', s)).toBe(RIGHT_BOUND)
    // 2026-07-02 is day 182 of the 364-day span: exactly the middle.
    expect(positionPct('2026-07-02', s)).toBe(50)
  })

  it('withinScale accepts the bounds and rejects the outside', () => {
    expect(withinScale('2026-01-01', s)).toBe(true)
    expect(withinScale('2026-12-31', s)).toBe(true)
    expect(withinScale('2025-12-31', s)).toBe(false)
    expect(withinScale('2027-01-01', s)).toBe(false)
  })
})

describe('needsStagger', () => {
  it(`true below a ${MIN_GAP_PCT} % gap, false at or above it`, () => {
    expect(needsStagger([8, 19])).toBe(true) // gap 11 < 12
    expect(needsStagger([8, 21])).toBe(false) // gap 13 ≥ 12
    expect(needsStagger([8, 20])).toBe(false) // gap 12: exactly the threshold
  })

  it('fewer than two positions never stagger', () => {
    expect(needsStagger([])).toBe(false)
    expect(needsStagger([50])).toBe(false)
  })
})
