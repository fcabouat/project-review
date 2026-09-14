/**
 * Pins the recap pagination (`src/projections/recap.ts`) — acceptance values
 * on the sample sets and the `recapRows` guard.
 */
import { describe, expect, it } from 'vitest'
import { recapPages } from '../../src/projections/index'
import { SAMPLE_SETS, fr } from '../fixtures/sample-sets'

describe.each(SAMPLE_SETS)('exact recap — %s data set', (_name, p) => {
  it('recap paginates as [11, 6]', () => {
    expect(recapPages(p).map((page) => page.length)).toEqual([11, 6])
  })
})

describe('recapRows guard', () => {
  it('guards a recapRows below 1 back to the 11-row default', () => {
    // The parse never produces 0, but the API is callable directly: documented guard.
    const p = { ...fr, settings: { ...fr.settings, recapRows: 0 } }
    expect(recapPages(p).map((page) => page.length)).toEqual([11, 6])
  })
})
