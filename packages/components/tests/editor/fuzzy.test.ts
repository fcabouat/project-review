/**
 * Pins the project search (`src/editor/fuzzy.ts`) — accent-folding
 * normalisation, subsequence scoring and its ranking rules, then the filter
 * run over the real sample data set (the acceptance criterion: « reseau »
 * finds the réseau project despite the missing accent).
 */
import { describe, expect, it } from 'vitest'
import {
  fuzzyFilter,
  fuzzyMatches,
  fuzzyScore,
  fuzzyScoreOf,
  normalize,
} from '../../src/editor/fuzzy'
import rawSample from '@project-review/core/samples/sample-portfolio.fr.json'
import { parsePortfolio } from '@project-review/core/services/parse'

describe('normalize', () => {
  it('folds accents onto their base letter', () => {
    expect(normalize('réseau')).toBe('reseau')
    expect(normalize('À cadrer')).toBe('a cadrer')
    expect(normalize('Téléphonie Unifiée')).toBe('telephonie unifiee')
    expect(normalize('KOVAČ')).toBe('kovac')
  })

  it('folds case and the typographic apostrophe', () => {
    expect(normalize('L’ACCUEIL')).toBe("l'accueil")
  })

  it('leaves plain ASCII alone', () => {
    expect(normalize('P-04')).toBe('p-04')
  })
})

describe('fuzzyScore', () => {
  it('matches through a missing accent — the criterion of the plan', () => {
    expect(fuzzyMatches('reseau', 'Renforcement du lien réseau du studio de Bordeaux')).toBe(true)
  })

  it('matches a subsequence, not only a substring', () => {
    expect(fuzzyMatches('msg', 'Migration de la messagerie')).toBe(true)
    expect(fuzzyMatches('mgr', 'Migration')).toBe(true)
  })

  it('ignores case in both directions', () => {
    expect(fuzzyMatches('TOIP', 'Passage de la téléphonie fixe en ToIP')).toBe(true)
    expect(fuzzyMatches('bordeaux', 'BORDEAUX')).toBe(true)
  })

  it('rejects a letter that is absent, and one that is out of order', () => {
    expect(fuzzyScore('zzz', 'Refonte de l’intranet')).toBeUndefined()
    expect(fuzzyScore('uaese', 'réseau')).toBeUndefined()
  })

  it('gives the empty query the perfect score', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
  })

  it('ranks a prefix above a late, scattered match', () => {
    const prefix = fuzzyScore('res', 'Réseau du studio')
    const scattered = fuzzyScore('res', 'Renouvellement des stations')
    expect(prefix).toBeDefined()
    expect(scattered).toBeDefined()
    expect(prefix as number).toBeLessThan(scattered as number)
  })

  it('ranks a contiguous run above a gapped one at the same offset', () => {
    const contiguous = fuzzyScore('abc', 'abcxxxx') as number
    const gapped = fuzzyScore('abc', 'axbxcxx') as number
    expect(contiguous).toBeLessThan(gapped)
  })
})

describe('fuzzyScoreOf', () => {
  it('keeps the best of several fields', () => {
    const best = fuzzyScoreOf('p-04', ['P-04', 'Sauvegarde externalisée']) as number
    expect(best).toBeLessThan(1)
  })

  it('a LATER field wins when it scores better — the best is updated, not the first kept', () => {
    const scattered = fuzzyScore('res', 'Renouvellement des stations') as number
    const prefix = fuzzyScore('res', 'Réseau') as number
    expect(prefix).toBeLessThan(scattered)
    expect(fuzzyScoreOf('res', ['Renouvellement des stations', 'Réseau'])).toBe(prefix)
  })

  it('skips undefined fields without matching them', () => {
    expect(fuzzyScoreOf('x', [undefined, undefined])).toBeUndefined()
  })
})

describe('fuzzyFilter over the real sample data set', () => {
  const result = parsePortfolio(rawSample)
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  const projects = result.portfolio.projects
  const fieldsOf = (p: (typeof projects)[number]) => [p.id, p.name, p.lead]

  it('« reseau » singles out P-06 despite the missing accent (plan criterion)', () => {
    const found = fuzzyFilter(projects, 'reseau', fieldsOf)
    expect(found.map((p) => p.id)).toContain('P-06')
  })

  it('finds a project by its id', () => {
    expect(fuzzyFilter(projects, 'P-04', fieldsOf).map((p) => p.id)).toEqual(['P-04'])
  })

  it('returns everything, in portfolio order, for an empty query', () => {
    const found = fuzzyFilter(projects, '', fieldsOf)
    expect(found).toEqual(projects)
  })

  it('returns nothing for a query no project can satisfy', () => {
    expect(fuzzyFilter(projects, 'qqqqqqjjjj', fieldsOf)).toEqual([])
  })
})
