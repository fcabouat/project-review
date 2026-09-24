/**
 * Pins the recap pagination (`src/projections/recap.ts`) — acceptance values
 * on the sample sets and the `recapRows` guard.
 */
import { describe, expect, it } from 'vitest'
import { recapPages } from '../../src/projections/index'
import { isArchived } from '../../src/projections/projects'
import { SAMPLE_SETS, fr } from '../fixtures/sample-sets'

describe.each(SAMPLE_SETS)('exact recap — %s data set', (_name, p) => {
  it('recap paginates as [10, 7]', () => {
    expect(recapPages(p).map((page) => page.length)).toEqual([10, 7])
  })
})

describe('recapRows guard', () => {
  it('caps tagged rows at six while preserving smaller preferences and ignoring archived tags', () => {
    const p = {
      ...fr,
      settings: { ...fr.settings, recapRows: 16 },
      projects: fr.projects.map((project) => ({ ...project, scopeTags: ['#site-06'] })),
    }
    expect(recapPages(p).map((page) => page.length)).toEqual([6, 6, 5])
    expect(p.settings.recapRows).toBe(16)
    expect(
      // The parsed preference starts at six; direct callers may still ask for less.
      recapPages({ ...p, settings: { ...p.settings, recapRows: 3 } }).map((page) => page.length),
    ).toEqual([3, 3, 3, 3, 3, 2])
    const archivedOnly = {
      ...p,
      projects: p.projects.map((project) => ({
        ...project,
        scopeTags: isArchived(project) ? ['#site-06'] : [],
      })),
    }
    expect(recapPages(archivedOnly).map((page) => page.length)).toEqual([10, 7])
  })
  it('caps owner-bearing rows at 10 without changing the stored preference', () => {
    const p = { ...fr, settings: { ...fr.settings, recapRows: 16 } }
    expect(recapPages(p).map((page) => page.length)).toEqual([10, 7])
    expect(p.settings.recapRows).toBe(16)
    expect(
      recapPages({
        ...p,
        projects: p.projects.map((project) => ({ ...project, lead: undefined })),
      }).map((page) => page.length),
    ).toEqual([16, 1])
  })
  it('guards a recapRows below 1 back to the 11-row default', () => {
    // The parse never produces 0, but the API is callable directly: documented guard.
    const p = { ...fr, settings: { ...fr.settings, recapRows: 0 } }
    expect(recapPages(p).map((page) => page.length)).toEqual([10, 7])
  })
})
