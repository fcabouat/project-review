/**
 * Pins the identifier vocabulary (`src/values/ids.ts`) — non-empty
 * constructors, the sanctioned empty reference, and the deterministic
 * allocators the id-uniqueness invariant rests on.
 */
import { describe, expect, it } from 'vitest'
import { NO_CATEGORY, categoryId, freeSlideId, projectId } from '../../src/values/ids'

describe('identifier constructors', () => {
  it('preserve ordinary Unicode ids without normalization', () => {
    expect(categoryId('infra')).toBe('infra')
    expect(projectId('P-01')).toBe('P-01')
    expect(freeSlideId('free-1')).toBe('free-1')
    expect(projectId('un id très libre — 2027')).toBe('un id très libre — 2027')
    for (const id of ['🚀/東京', 'e\u0301', 'é', 'opening', 'closing', 'unsorted']) {
      for (const construct of [categoryId, projectId, freeSlideId]) {
        expect(construct(id)).toBe(id)
        expect(decodeURIComponent(encodeURIComponent(construct(id)!))).toBe(id)
      }
    }
  })

  it('refuse the empty string', () => {
    expect(categoryId('')).toBeUndefined()
    expect(projectId('')).toBeUndefined()
    expect(freeSlideId('')).toBeUndefined()
  })

  it('refuse isolated surrogate halves without silently replacing them', () => {
    for (const id of ['\ud800', '\udfff', 'prefix\ud800suffix', '\udc00\ud800']) {
      for (const construct of [categoryId, projectId, freeSlideId]) {
        expect(construct(id)).toBeUndefined()
      }
    }
  })

  it('NO_CATEGORY is the sanctioned empty reference, serialised as ""', () => {
    expect(NO_CATEGORY).toBe('')
  })
})
