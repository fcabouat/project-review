/**
 * Pins the identifier vocabulary (`src/values/ids.ts`) — non-empty
 * constructors, the sanctioned empty reference, and the deterministic
 * allocators the id-uniqueness invariant rests on.
 */
import { describe, expect, it } from 'vitest'
import {
  NO_CATEGORY,
  categoryId,
  freeSlideId,
  nextCategoryId,
  nextFreeSlideId,
  nextProjectId,
  projectId,
} from '../../src/values/ids'

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

describe('nextFreeSlideId', () => {
  it('counts from the collection size, like the project ids', () => {
    expect(nextFreeSlideId([])).toBe('free-1')
    expect(nextFreeSlideId(['opening'])).toBe('free-2')
    expect(nextFreeSlideId(['free-1', 'free-2'])).toBe('free-3')
  })

  it('skips over ids already taken, wherever they came from', () => {
    // Two slides, but `free-3` was minted earlier (a deletion left a hole):
    // the counter walks past it instead of colliding.
    expect(nextFreeSlideId(['opening', 'free-3'])).toBe('free-4')
    expect(nextFreeSlideId(['free-2'])).toBe('free-3')
  })

  it('accepts the slides themselves, not just their ids', () => {
    expect(nextFreeSlideId([{ id: 'opening' }, { id: 'free-3' }])).toBe('free-4')
  })

  it('is deterministic and never returns an existing id', () => {
    const existing = ['free-1', 'annexe', 'free-4', 'free-2']
    const id = nextFreeSlideId(existing)
    expect(id).toBe(nextFreeSlideId(existing))
    expect(existing).not.toContain(id)
  })
})

describe('nextProjectId', () => {
  it('mints two-digit P-NN ids and skips taken ones', () => {
    expect(nextProjectId([])).toBe('P-01')
    expect(nextProjectId(['P-01', 'P-02'])).toBe('P-03')
    expect(nextProjectId(['P-01', 'P-03'])).toBe('P-04')
    expect(nextProjectId([{ id: 'P-01' }, { id: 'P-02' }, { id: 'P-03' }])).toBe('P-04')
  })
})

describe('nextCategoryId', () => {
  it('mints category-N ids and skips taken ones', () => {
    expect(nextCategoryId([])).toBe('category-1')
    expect(nextCategoryId(['category-1'])).toBe('category-2')
    expect(nextCategoryId(['infra', 'category-2'])).toBe('category-3')
  })
})
