/**
 * Pins the sheet-tile derivations (`src/projections/gauges.ts`) — the
 * progress ramp, the gauge and the risks band.
 */
import { describe, expect, it } from 'vitest'
import { progressRamp, projectGauge, projectById, risksLevel } from '../../src/projections/index'
import { SAMPLE_SETS, fr } from '../fixtures/sample-sets'

describe.each(SAMPLE_SETS)('exact gauges — %s data set', (_name, p) => {
  it('gauge: pre-project not assessed, ramp by bands', () => {
    expect(projectGauge(projectById(p, 'P-05')!)).toEqual({ type: 'notAssessed' })
    expect(projectGauge(projectById(p, 'P-04')!)).toEqual({
      type: 'value',
      pct: 35,
      band: 'yellow',
    })
  })
})

describe('unit functions', () => {
  it('progressRamp: bands 0 / 1-33 / 34-66 / 67-99 / 100 / absent', () => {
    expect(progressRamp(undefined)).toBe('grey')
    expect(progressRamp(0)).toBe('red')
    expect(progressRamp(1)).toBe('orange')
    expect(progressRamp(33)).toBe('orange')
    expect(progressRamp(34)).toBe('yellow')
    expect(progressRamp(66)).toBe('yellow')
    expect(progressRamp(67)).toBe('lightGreen')
    expect(progressRamp(99)).toBe('lightGreen')
    expect(progressRamp(100)).toBe('green')
  })

  it('risksLevel: neutral when empty, health-toned otherwise, confident by default', () => {
    expect(risksLevel(projectById(fr, 'P-13')!)).toBe('neutral') // no risks text
    expect(risksLevel(projectById(fr, 'P-04')!)).toBe('alert')
    expect(risksLevel(projectById(fr, 'P-06')!)).toBe('critical')
    expect(risksLevel(projectById(fr, 'P-01')!)).toBe('onTrack') // health confiance + risks text
  })
})
