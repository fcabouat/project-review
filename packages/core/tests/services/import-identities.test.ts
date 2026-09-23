import { describe, expect, it } from 'vitest'
import { testPortfolio } from '../fixtures/hand-built-portfolios'
import {
  emptyImportSelection,
  importSummary,
  mixPortfolio,
} from '../../src/services/portfolio-import'
import { projectId, categoryId, freeSlideId } from '../../src/values/ids'
import { verdict } from '../../src/commands'
import { apply, invert } from '../../src/events'
import { readImportJson } from '../../src/services/parse/import-file'

describe('identity-based imports', () => {
  const source = (portfolio: ReturnType<typeof testPortfolio>) => ({
    kind: 'portfolio' as const,
    portfolio,
  })
  const before = testPortfolio()
  it('adds three independently created projects to two local projects, preserving review and appearance', () => {
    const local = { ...before, projects: before.projects.slice(0, 2) }
    const incoming = {
      ...before,
      projects: before.projects.map((p, i) => ({
        ...p,
        id: projectId(`independent-${i}`)!,
        reference: `P-0${i + 1}`,
      })),
    }
    const mixed = mixPortfolio(local, source(incoming), {
      ...emptyImportSelection(),
      projects: incoming.projects.map((p) => p.id),
    })
    expect(mixed.projects).toHaveLength(5)
    expect(mixed.projects.slice(0, 2)).toEqual(local.projects)
    expect(mixed.review).toBe(local.review)
    expect(mixed.settings).toEqual(local.settings)
    expect(importSummary(local, mixed)).toMatchObject({ added: 3, replaced: 0, removed: 0 })
    expect(
      mixPortfolio(mixed, source(incoming), {
        ...emptyImportSelection(),
        projects: incoming.projects.map((p) => p.id),
      }),
    ).toEqual(mixed)
  })
  it('keeps a differing known identity unless a whole-project replacement is explicitly selected, and undoes in one step', () => {
    const incoming = {
      ...before,
      projects: [
        { ...before.projects[0]!, name: 'Received version', lead: undefined, reference: 'New ref' },
      ],
    }
    const selected = { ...emptyImportSelection(), projects: [incoming.projects[0]!.id] }
    expect(mixPortfolio(before, source(incoming), selected)).toEqual(before)
    const candidate = mixPortfolio(before, source(incoming), {
      ...selected,
      resolutions: [{ collection: 'projects', id: incoming.projects[0]!.id, action: 'replace' }],
    })
    expect(candidate.projects[0]).toEqual(incoming.projects[0])
    const result = verdict(before, { type: 'ReplacePortfolio', portfolio: candidate })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected valid import')
    expect(apply(apply(before, result.event), invert(result.event))).toEqual(before)
  })
  it('copies with a fresh identity, preserves the source and rejects colliding copy identities', () => {
    const selected = {
      ...emptyImportSelection(),
      projects: [before.projects[0]!.id],
      resolutions: [
        {
          collection: 'projects' as const,
          id: before.projects[0]!.id,
          action: 'copy' as const,
          copyId: 'fresh-copy',
        },
      ],
    }
    const candidate = mixPortfolio(before, source(before), selected)
    expect(candidate.projects).toHaveLength(before.projects.length + 1)
    expect(candidate.projects.at(-1)).toEqual({ ...before.projects[0], id: 'fresh-copy' })
    const bad = mixPortfolio(before, source(before), {
      ...selected,
      resolutions: [{ ...selected.resolutions[0]!, copyId: before.projects[0]!.id }],
    })
    expect(verdict(before, { type: 'ReplacePortfolio', portfolio: bad }).ok).toBe(false)
  })
  it('maps incoming project and free-slide category references without modifying local categories', () => {
    const foreign = categoryId('foreign-category')!,
      target = before.categories[0]!.id
    const incoming = {
      ...before,
      categories: [{ ...before.categories[0]!, id: foreign }],
      projects: [{ ...before.projects[0]!, id: projectId('new')!, categoryId: foreign }],
      freeSlides: [
        {
          ...before.freeSlides[0]!,
          id: freeSlideId('new-slide')!,
          anchor: { type: 'beforeCategory' as const, categoryId: foreign },
        },
      ],
    }
    const candidate = mixPortfolio(before, source(incoming), {
      ...emptyImportSelection(),
      categories: [foreign],
      projects: ['new'],
      freeSlides: ['new-slide'],
      categoryLinks: [{ sourceId: foreign, targetId: target }],
    })
    expect(candidate.categories).toEqual(before.categories)
    expect(candidate.projects.at(-1)?.categoryId).toBe(target)
    expect(candidate.freeSlides.at(-1)?.anchor).toEqual({
      type: 'beforeCategory',
      categoryId: target,
    })
  })
  it('rejects v3, keeps a reference optional and refuses changing technical identity through a field command', () => {
    expect(readImportJson(JSON.stringify({ ...before, version: 3 })).ok).toBe(false)
    expect(readImportJson(JSON.stringify(before)).ok).toBe(true)
    expect(
      verdict(before, {
        type: 'ChangeProjectField',
        id: before.projects[0]!.id,
        field: 'id',
        after: 'tampered',
      } as never).ok,
    ).toBe(false)
    const result = verdict(before, {
      type: 'ChangeProjectField',
      id: before.projects[0]!.id,
      field: 'reference',
      after: 'REF',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(apply(before, result.event).projects[0]?.id).toBe(before.projects[0]!.id)
  })
})
