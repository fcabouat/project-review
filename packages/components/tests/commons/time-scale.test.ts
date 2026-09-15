import { describe, expect, it } from 'vitest'
import { timelineLayout } from '../../src/commons/time-scale'

describe('milestone layout', () => {
  it('handles no dates, a lone date, and review dates outside the visible range', () => {
    expect(timelineLayout([], '2026-09-01')).toEqual({
      positions: [],
      staggered: false,
      adjusted: false,
    })
    expect(timelineLayout(['2026-09-01'], '2026-09-01')).toEqual({
      positions: [50],
      staggered: false,
      adjusted: false,
      cursor: 50,
    })
    expect(timelineLayout(['2026-09-01'], '2026-08-31').cursor).toBeUndefined()
    expect(timelineLayout(['2026-09-01'], '2026-09-02').cursor).toBeUndefined()
  })

  it('preserves proportional time spacing when readable, including cursor interpolation', () => {
    const layout = timelineLayout(['2026-01-01', '2026-01-05', '2026-01-09'], '2026-01-03')
    expect(layout).toEqual({
      positions: [12, 50, 88],
      staggered: false,
      adjusted: false,
      cursor: 31,
    })
    expect(timelineLayout(['2026-01-01', '2026-01-05', '2026-01-09'], '2026-01-09').cursor).toBe(88)
  })

  it.each([
    ['2025-07-31', '2025-10-21', '2025-10-24', '2025-11-24', '2026-05-20'],
    ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-12-31'],
    Array.from({ length: 6 }, () => '2026-09-01'),
  ])('keeps crowded markers ordered, inside the frame, and separated: %j', (...dates) => {
    const layout = timelineLayout(dates, dates[0]!)
    expect(layout.adjusted).toBe(true)
    expect(layout.staggered).toBe(true)
    layout.positions.forEach((p, i) => {
      expect(p).toBeGreaterThanOrEqual(12)
      expect(p).toBeLessThanOrEqual(88)
      if (i > 0) expect(p - layout.positions[i - 1]!).toBeGreaterThanOrEqual(14 - 1e-9)
      // Labels are 24% wide; alternating lanes have at least 28% between centres.
      if (i > 1) expect(p - layout.positions[i - 2]!).toBeGreaterThan(24)
    })
  })

  it('maps the cursor through adjusted positions, not the original linear scale', () => {
    const dates = ['2026-01-01', '2026-01-02', '2026-01-04', '2026-12-31']
    const layout = timelineLayout(dates, '2026-01-03')
    expect(layout.cursor).toBeCloseTo((layout.positions[1]! + layout.positions[2]!) / 2)
    expect(timelineLayout(dates, '2026-01-02').cursor).toBeCloseTo(layout.positions[1]!)
  })

  it('represents a same-day group by its midpoint without division by zero', () => {
    const layout = timelineLayout(['2026-09-01', '2026-09-01', '2026-09-01'], '2026-09-01')
    expect(layout.cursor).toBeCloseTo(50)
    expect(layout.positions[1]).toBeCloseTo(50)
  })
})
