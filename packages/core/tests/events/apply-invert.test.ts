/**
 * Pins the event algebra of `src/events/apply.ts` and `src/events/invert.ts`:
 * the laws `apply(apply(p, e), invert(e)) ≡ p` (inversion), involution,
 * totality, immutability and purity of `invert` — for EVERY event variant,
 * via the exhaustive `EVENT_SAMPLES` table (`../fixtures/event-samples.ts`).
 */

import { describe, expect, it } from 'vitest'
import type { Portfolio } from '../../src/model/portfolio'
import { categoryId, freeSlideId, projectId } from '../../src/values/ids'
import {
  apply,
  invert,
  PROJECT_SCALAR_FIELDS,
  REVIEW_FIELDS,
  type DomainEvent,
} from '../../src/events/index'
import {
  NEW_CATEGORY,
  NEW_PROJECT,
  NEW_SLIDE,
  projectOf,
  testPortfolio,
} from '../fixtures/hand-built-portfolios'
import { EVENT_SAMPLES } from '../fixtures/event-samples'

const p = testPortfolio()

describe('invertibility — one entry per variant of the union', () => {
  // The fingerprint doubles as the immutability check: after every round trip
  // of every variant, `p` must be byte-for-byte the portfolio it started as.
  const fingerprint = JSON.stringify(p)

  for (const [name, list] of Object.entries(EVENT_SAMPLES)) {
    it(`${name} (${list.length} sample(s))`, () => {
      expect(list.length).toBeGreaterThan(0)
      for (const e of list) {
        expect(apply(apply(p, e), invert(e))).toStrictEqual(p)
        // Involutive: invert(invert(e)) applies like e.
        expect(apply(p, invert(invert(e)))).toStrictEqual(apply(p, e))
      }
      expect(JSON.stringify(p)).toBe(fingerprint)
    })
  }
})

describe('invert', () => {
  it('does not consult the portfolio (pure: same output out of context)', () => {
    // If this breaks, the inverse of an event has stopped being computable
    // from the event alone — the property that lets undo replay over a
    // history reloaded from storage, without any snapshot of the portfolio.
    const e: DomainEvent = {
      type: 'ProjectRenumbered',
      oldId: projectId('P-01')!,
      newId: projectId('P-99')!,
    }
    expect(invert(e)).toStrictEqual({
      type: 'ProjectRenumbered',
      oldId: projectId('P-99')!,
      newId: projectId('P-01')!,
    })
  })
})

describe('apply — expected effects', () => {
  it('changes the right field without touching the others', () => {
    const e: DomainEvent = {
      type: 'ProjectFieldChanged',
      id: 'P-01',
      field: 'health',
      before: 'watch',
      after: 'alert',
    }
    const after = apply(p, e)
    expect(projectOf(after, 'P-01').health).toBe('alert')
    expect(projectOf(after, 'P-01').name).toBe(projectOf(p, 'P-01').name)
    expect(after.projects).toHaveLength(3)
    expect(after.categories).toBe(p.categories)
  })

  it('erases the key rather than setting `undefined` on it', () => {
    // `'health' in project` and not `=== undefined`: an explicit undefined key
    // would survive JSON.stringify checks but break the key-census equality
    // the export round-trip test relies on.
    const e: DomainEvent = {
      type: 'ProjectFieldChanged',
      id: 'P-01',
      field: 'health',
      before: 'watch',
      after: undefined,
    }
    const project = projectOf(apply(p, e), 'P-01')
    expect('health' in project).toBe(false)
  })

  it('moves by removal then re-insertion (splice semantics)', () => {
    const ids = (q: Portfolio): readonly string[] => q.projects.map((x) => x.id)
    expect(ids(apply(p, { type: 'ProjectMoved', id: 'P-01', from: 0, to: 2 }))).toEqual([
      'P-02',
      'P-03',
      'P-01',
    ])
    expect(ids(apply(p, { type: 'ProjectMoved', id: 'P-03', from: 2, to: 0 }))).toEqual([
      'P-03',
      'P-01',
      'P-02',
    ])
  })

  it('reaches the setting targeted by the closed path', () => {
    const q = apply(p, {
      type: 'SettingChanged',
      setting: 'palette',
      before: 'gov',
      after: 'material',
    })
    expect(q.settings.theme.palette).toBe('material')
    expect(q.settings.show).toStrictEqual(p.settings.show)

    const r = apply(p, {
      type: 'SettingChanged',
      setting: 'archives',
      before: true,
      after: false,
    })
    expect(r.settings.show.archives).toBe(false)
    expect(r.settings.show.recap).toBe(true)
    expect(r.settings.theme.palette).toBe('gov')
  })
})

describe('apply is total', () => {
  const inapplicable: readonly DomainEvent[] = [
    { type: 'ProjectFieldChanged', id: 'ABSENT', field: 'name', before: 'x', after: 'y' },
    { type: 'ProjectListChanged', id: 'ABSENT', list: 'done', before: [], after: ['a'] },
    { type: 'ProjectMilestonesChanged', id: 'ABSENT', before: [], after: [] },
    { type: 'ProjectDecisionsChanged', id: 'ABSENT', before: [], after: [] },
    { type: 'ProjectMoved', id: 'ABSENT', from: 0, to: 1 },
    { type: 'ProjectRenumbered', oldId: projectId('ABSENT')!, newId: projectId('P-99')! },
    { type: 'ProjectDeleted', project: { ...NEW_PROJECT, id: projectId('ABSENT')! }, index: 0 },
    { type: 'CategoryRenamed', id: 'ABSENT', before: 'a', after: 'b' },
    { type: 'CategoryRecolored', id: 'ABSENT', before: 'blue', after: 'red' },
    { type: 'CategoryMoved', id: 'ABSENT', from: 0, to: 1 },
    { type: 'CategoryDeleted', category: { ...NEW_CATEGORY, id: categoryId('ABSENT')! }, index: 0 },
    { type: 'FreeSlideChanged', id: 'ABSENT', before: NEW_SLIDE, after: NEW_SLIDE },
    { type: 'FreeSlideMoved', id: 'ABSENT', from: 0, to: 1 },
    { type: 'FreeSlideDeleted', slide: { ...NEW_SLIDE, id: freeSlideId('ABSENT')! }, index: 0 },
  ]

  for (const e of inapplicable) {
    it(`${e.type} on a non-existent id → portfolio unchanged`, () => {
      expect(() => apply(p, e)).not.toThrow()
      expect(apply(p, e)).toStrictEqual(p)
    })
  }

  it('clamps out-of-range insertion indexes without throwing', () => {
    const start = apply(p, { type: 'ProjectCreated', project: NEW_PROJECT, index: -5 })
    const end = apply(p, { type: 'ProjectCreated', project: NEW_PROJECT, index: 99 })
    expect(start.projects.map((x) => x.id)).toEqual(['P-99', 'P-01', 'P-02', 'P-03'])
    expect(end.projects.map((x) => x.id)).toEqual(['P-01', 'P-02', 'P-03', 'P-99'])
  })

  it('clamps an out-of-range move destination without throwing', () => {
    const q = apply(p, { type: 'ProjectMoved', id: 'P-01', from: 0, to: 99 })
    expect(q.projects.map((x) => x.id)).toEqual(['P-02', 'P-03', 'P-01'])
  })
})

describe('renumbering', () => {
  const renumbered: DomainEvent = {
    type: 'ProjectRenumbered',
    oldId: projectId('P-01')!,
    newId: projectId('P-99')!,
  }
  const changed: DomainEvent = {
    type: 'ProjectFieldChanged',
    id: 'P-99',
    field: 'health',
    before: 'watch',
    after: 'critical',
  }

  it('allows editing the project under its new id', () => {
    const q = apply(apply(p, renumbered), changed)
    expect(q.projects.map((x) => x.id)).toEqual(['P-99', 'P-02', 'P-03'])
    expect(projectOf(q, 'P-99').health).toBe('critical')
    expect(projectOf(q, 'P-99').name).toBe(projectOf(p, 'P-01').name)
  })

  it('undoes in reverse order and restores the initial state', () => {
    const q = apply(apply(p, renumbered), changed)
    const back = apply(apply(q, invert(changed)), invert(renumbered))
    expect(back).toStrictEqual(p)
  })

  it('keeps the position of the project', () => {
    expect(apply(p, renumbered).projects.map((x) => x.id)).toEqual(['P-99', 'P-02', 'P-03'])
  })
})

describe('immutability', () => {
  it('shares untouched subtrees (structural copy)', () => {
    // Reference equality, not structural: `apply` promises to copy ONLY the
    // path it changes — that sharing is what keeps 500 events of history
    // affordable in memory.
    const q = apply(p, {
      type: 'ReviewFieldChanged',
      field: 'title',
      before: 'Revue des projets',
      after: 'Revue trimestrielle',
    })
    expect(q.projects).toBe(p.projects)
    expect(q.categories).toBe(p.categories)
    expect(q.freeSlides).toBe(p.freeSlides)
    expect(q.review).not.toBe(p.review)
  })
})

describe('coverage of the field lists', () => {
  it('forgets no field of the P-01 fixture', () => {
    // Runtime re-check of the compile-time `CoversExactly` guards: the field
    // lists driving the per-field event families must cover exactly what a
    // maximal project (P-01) actually carries.
    const expected = Object.keys(projectOf(p, 'P-01')).filter(
      (c) => !['id', 'done', 'ongoing', 'next', 'decisions', 'milestones'].includes(c),
    )
    expect([...PROJECT_SCALAR_FIELDS].sort()).toEqual(expected.sort())
    expect([...REVIEW_FIELDS].sort()).toEqual(Object.keys(p.review).sort())
  })
})
