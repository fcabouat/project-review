/**
 * Pins `isoDate` (`src/values/date.ts`) — the one constructor of
 * calendar-valid dates: what it accepts, what it refuses, and the
 * lexicographic-comparison invariant every date comparison in the app uses.
 */
import { describe, expect, it } from 'vitest'
import { isoDate } from '../../src/values/date'

describe('isoDate', () => {
  it('accepts calendar-valid YYYY-MM-DD dates', () => {
    expect(isoDate('2026-09-03')).toBe('2026-09-03')
    expect(isoDate('2026-01-31')).toBe('2026-01-31')
    expect(isoDate('2024-02-29')).toBe('2024-02-29') // leap year
    expect(isoDate('2000-02-29')).toBe('2000-02-29') // ÷400: leap
    expect(isoDate('2026-12-31')).toBe('2026-12-31')
  })

  it('refuses malformed shapes', () => {
    for (const bad of ['', '03/09/2026', '2026-9-3', '2026-09-03T00:00', '20260903', 'demain']) {
      expect(isoDate(bad)).toBeUndefined()
    }
  })

  it('refuses calendar-impossible dates', () => {
    expect(isoDate('2026-00-10')).toBeUndefined()
    expect(isoDate('2026-13-01')).toBeUndefined()
    expect(isoDate('2026-04-31')).toBeUndefined()
    expect(isoDate('2026-02-29')).toBeUndefined() // not a leap year
    expect(isoDate('1900-02-29')).toBeUndefined() // ÷100 but not ÷400: not leap
    expect(isoDate('2026-01-00')).toBeUndefined()
    expect(isoDate('2026-01-32')).toBeUndefined()
  })

  it('compares chronologically with plain string operators', () => {
    const a = isoDate('2026-09-30')!
    const b = isoDate('2026-10-01')!
    expect(a < b).toBe(true)
  })
})
