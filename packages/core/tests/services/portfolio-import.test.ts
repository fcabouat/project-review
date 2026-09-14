import { describe, expect, it } from 'vitest'
import { testPortfolio, otherPortfolio } from '../fixtures/hand-built-portfolios'
import {
  appearanceProfile,
  emptyImportSelection,
  importSummary,
  mixPortfolio,
  sameImportValue,
} from '../../src/services/portfolio-import'
import { readImportJson } from '../../src/services/parse/import-file'
import { MAX_CHARS } from '../../src/model/budget'
import { categoryId, NO_CATEGORY } from '../../src/values/ids'

describe('readImportJson', () => {
  it('reads a strict portfolio and an appearance profile', () => {
    const portfolio = testPortfolio()
    const full = readImportJson(JSON.stringify(portfolio))
    expect(full.ok && full.source.kind).toBe('portfolio')
    const profile = readImportJson(JSON.stringify(appearanceProfile(portfolio)))
    expect(profile.ok && profile.source.kind).toBe('appearance')
    if (profile.ok) {
      expect(profile.source.portfolio.review).not.toEqual(portfolio.review)
      expect(profile.source.portfolio.projects).toEqual([])
    }
  })

  it('refuses unknown, missing, bad version, oversized and malformed input', () => {
    expect(readImportJson('{"format":"other"}')).toMatchObject({ ok: false })
    expect(readImportJson('{"format":"project-review-appearance"}')).toMatchObject({ ok: false })
    expect(
      readImportJson(
        JSON.stringify({
          format: 'project-review-appearance',
          version: 1,
          settings: {},
          categories: [],
        }),
      ),
    ).toMatchObject({ ok: false })
    expect(
      readImportJson(JSON.stringify({ ...appearanceProfile(testPortfolio()), version: 2 })),
    ).toMatchObject({ ok: false })
    expect(readImportJson('{')).toEqual({ ok: false, refusal: 'badJson' })
    expect(readImportJson('x'.repeat(MAX_CHARS + 1))).toEqual({ ok: false, refusal: 'tooLarge' })
  })
})

describe('mixPortfolio', () => {
  it('changes selected categories only, never projects from malicious selections', () => {
    const before = testPortfolio()
    const incoming = otherPortfolio()
    const mixed = mixPortfolio(
      before,
      { kind: 'portfolio', portfolio: incoming },
      {
        ...emptyImportSelection(),
        categories: incoming.categories.map((c) => c.id),
      },
    )
    expect(mixed.categories).toEqual([...before.categories, ...incoming.categories])
    expect(mixed.projects).toEqual(before.projects)
    expect(mixed.review).toBe(before.review)
  })

  it('profile imports never replace review or project collections', () => {
    const before = testPortfolio()
    const incoming = otherPortfolio()
    const mixed = mixPortfolio(
      before,
      { kind: 'appearance', portfolio: incoming },
      {
        blocks: ['review', 'language', 'identity', 'theme', 'display'],
        categories: incoming.categories.map((c) => c.id),
        projects: incoming.projects.map((p) => p.id),
        freeSlides: incoming.freeSlides.map((s) => s.id),
      },
    )
    expect(mixed.review).toBe(before.review)
    expect(mixed.projects).toBe(before.projects)
    expect(mixed.freeSlides).toBe(before.freeSlides)
    expect(mixed.settings.language).toBe(incoming.settings.language)
  })
})

describe('importSummary and sameImportValue', () => {
  it('reports order-only changes in a full restoration', () => {
    const before = testPortfolio()
    const after = { ...before, categories: [...before.categories].reverse() }
    expect(importSummary(before, after)).toMatchObject({
      added: 0,
      replaced: 0,
      removed: 0,
      reordered: ['categories'],
    })
  })
  it('handles independent appearance blocks and JSON array equality', () => {
    const before = testPortfolio()
    const after = { ...before, settings: { ...before.settings, language: 'en' as const } }
    expect(importSummary(before, after)).toMatchObject({
      added: 0,
      replaced: 0,
      removed: 0,
      blocks: ['language'],
    })
    expect(sameImportValue([{ a: 1 }, undefined], [{ a: 1 }, undefined])).toBe(true)
    expect(sameImportValue([1, 2], [1, 3])).toBe(false)
  })

  it('counts additions, replacements and removals, and reports missing category refs', () => {
    const before = testPortfolio()
    const after = {
      ...before,
      categories: [
        ...before.categories.slice(1),
        { id: categoryId('new-cat')!, name: 'New', color: 'blue' as const },
      ],
      projects: before.projects.map((p, i) => (i === 0 ? { ...p, name: `${p.name}!` } : p)),
      freeSlides: [
        {
          ...before.freeSlides[0]!,
          anchor: { type: 'beforeCategory' as const, categoryId: before.categories[0]!.id },
        },
      ],
    }
    const summary = importSummary(before, after)
    expect(summary.added).toBe(1)
    expect(summary.replaced).toBe(2)
    expect(summary.removed).toBe(before.categories.length - 1)
    expect(summary.missingCategories).toContain(after.projects[0]!.categoryId)
    const uncategorized = {
      ...before,
      projects: before.projects.map((p) => ({ ...p, categoryId: NO_CATEGORY })),
    }
    expect(importSummary(before, uncategorized).missingCategories).toEqual([])
  })
})
