/**
 * Pins THE single band → swatch mapping (`src/commons/band-color.ts`): total
 * over `ProgressBand`, and every swatch is a theme variable — never a
 * hard-coded color.
 */
import { describe, expect, it } from 'vitest'
import { BAND_COLOR } from '../../src/commons/band-color'

describe('BAND_COLOR', () => {
  it('maps all six bands, each onto a theme CSS variable', () => {
    expect(Object.keys(BAND_COLOR).sort()).toEqual(
      ['green', 'grey', 'lightGreen', 'orange', 'red', 'yellow'].sort(),
    )
    for (const swatch of Object.values(BAND_COLOR)) {
      expect(swatch).toMatch(/^var\(--av-[a-z0-9]+\)$/)
    }
  })
})
