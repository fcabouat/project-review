/**
 * Pins `decide` (`src/commands/decide.ts`) — the handlers completing an
 * intent into an event: truthful completion for every command variant (via
 * the exhaustive `COMMAND_SAMPLES` table, `../fixtures/command-samples.ts`),
 * and the two `undefined` contracts — inapplicable target, trivial no-op —
 * plus `verdict`, the same decision with the reason of a refusal attached.
 */
import { describe, expect, it } from 'vitest'
import { isoDate } from '../../src/values/date'
import { projectId } from '../../src/values/ids'
import { progressOf } from '../../src/values/progress'
import { apply, mergeReport, settingValue, type ProjectsMerged } from '../../src/events/index'
import { decide, verdict, type Command } from '../../src/commands/index'
import {
  MERGED_P02,
  NEW_CATEGORY,
  NEW_PROJECT,
  NEW_SLIDE,
  categoryOf,
  projectOf,
  slideOf,
  testPortfolio,
} from '../fixtures/hand-built-portfolios'
import { COMMAND_SAMPLES } from '../fixtures/command-samples'

const d = (x: string) => isoDate(x)!
const pid = (x: string) => projectId(x)!

const p = testPortfolio()

describe('decide — completion, one entry per command variant', () => {
  for (const [name, { command, event }] of Object.entries(COMMAND_SAMPLES)) {
    it(`${name} completes with the true before`, () => {
      // The `before`/`from` in the expected event come from the fixture, not
      // from `decide`: a decide that stopped reading the present would still
      // build a well-typed event — only this comparison catches the lie.
      expect(decide(p, command)).toStrictEqual(event)
    })
  }

  it('never mutates the portfolio it reads', () => {
    const fingerprint = JSON.stringify(p)
    for (const { command } of Object.values(COMMAND_SAMPLES)) decide(p, command)
    expect(JSON.stringify(p)).toBe(fingerprint)
  })

  it('what decide completes, apply applies and settingValue reads back', () => {
    const e = decide(p, { type: 'ChangeSetting', setting: 'recapRows', after: 8 })
    expect(e).toBeDefined()
    expect(settingValue(apply(p, e!).settings, 'recapRows')).toBe(8)
  })
})

describe('decide — inapplicable command → undefined', () => {
  const inapplicable: readonly Command[] = [
    { type: 'DeleteCategory', id: 'ABSENT' },
    { type: 'RenameCategory', id: 'ABSENT', after: 'X' },
    { type: 'RecolorCategory', id: 'ABSENT', after: 'red' },
    { type: 'MoveCategory', id: 'ABSENT', to: 1 },
    { type: 'DeleteProject', id: 'ABSENT' },
    { type: 'MoveProject', id: 'ABSENT', to: 1 },
    { type: 'RenumberProject', id: pid('ABSENT'), newId: pid('P-99') },
    { type: 'ChangeProjectField', id: 'ABSENT', field: 'name', after: 'X' },
    { type: 'ChangeProjectList', id: 'ABSENT', list: 'done', after: [] },
    { type: 'ChangeProjectMilestones', id: 'ABSENT', after: [] },
    { type: 'ChangeProjectDecisions', id: 'ABSENT', after: [] },
    { type: 'DeleteFreeSlide', id: 'ABSENT' },
    { type: 'ChangeFreeSlide', id: 'ABSENT', after: NEW_SLIDE },
    { type: 'MoveFreeSlide', id: 'ABSENT', to: 1 },
  ]
  for (const c of inapplicable) {
    it(`${c.type} on a non-existent target`, () => {
      expect(decide(p, c)).toBeUndefined()
    })
  }

  it('RenumberProject to an id already taken (uniqueness held by construction)', () => {
    // The one refusal that is not about a missing target: `apply` trusts id
    // uniqueness (it would duplicate — see events/ids-invariant.test.ts), so
    // the guard MUST live here, before anything is recorded.
    expect(
      decide(p, { type: 'RenumberProject', id: pid('P-01'), newId: pid('P-02') }),
    ).toBeUndefined()
  })
})

describe('decide — trivial scalar no-op → undefined', () => {
  // A trivial command records NOTHING: an "edit" that changed nothing must
  // not become an undo step that undoes nothing.
  const trivial: readonly Command[] = [
    { type: 'ChangeReviewField', field: 'title', after: 'Revue des projets' },
    { type: 'ChangeReviewField', field: 'previousReviewDate', after: d('2026-07-02') },
    { type: 'ChangeIdentityField', field: 'unit', after: 'DSI' },
    { type: 'ChangeSetting', setting: 'palette', after: 'tailwind' },
    { type: 'RenameCategory', id: 'infra', after: 'Infrastructure' },
    { type: 'RecolorCategory', id: 'poste', after: 'green' },
    { type: 'MoveCategory', id: 'infra', to: 0 },
    { type: 'MoveProject', id: 'P-01', to: 0 },
    { type: 'RenumberProject', id: pid('P-01'), newId: pid('P-01') },
    { type: 'ChangeProjectField', id: 'P-01', field: 'progress', after: progressOf(60)! },
    { type: 'ChangeProjectField', id: 'P-02', field: 'health', after: undefined },
    { type: 'MoveFreeSlide', id: 'opening', to: 0 },
  ]
  for (const c of trivial) {
    it(`${c.type} with the current value`, () => {
      expect(decide(p, c)).toBeUndefined()
    })
  }

  it('refuses a merge strictly void of effect — the documented exception judging deep equality', () => {
    // A colleague sending back an untouched file must not create an undo step
    // that undoes nothing. Structural, not referential: a re-built portfolio
    // is a different object with the same content — still refused, even with
    // an unused new category riding along.
    const clone = testPortfolio()
    expect(decide(p, { type: 'MergeProjects', projects: [], categories: [] })).toBeUndefined()
    expect(
      decide(p, {
        type: 'MergeProjects',
        projects: clone.projects,
        categories: [...clone.categories, NEW_CATEGORY],
      }),
    ).toBeUndefined()
  })

  it('wholesale replacements always produce their event (deep equality is not judged)', () => {
    // Documented boundary: lists, milestones, decisions, slides and imports
    // are replaced wholesale, and judging their triviality (deep comparison)
    // is declared the emitter's business — not decide's.
    const sameLists = decide(p, {
      type: 'ChangeProjectList',
      id: 'P-02',
      list: 'done',
      after: [],
    })
    expect(sameLists).toBeDefined()
    const sameSlide = decide(p, {
      type: 'ChangeFreeSlide',
      id: 'opening',
      after: slideOf(p, 'opening'),
    })
    expect(sameSlide).toBeDefined()
  })
})

describe('decide — MergeProjects (the merge contract, src/commands/merge.ts)', () => {
  // The full-shaped contribution: one homonym reworked, one new project, the
  // category 'poste' renamed by the colleague (must NOT win), one new category.
  const contribution: Command = {
    type: 'MergeProjects',
    projects: [MERGED_P02, NEW_PROJECT],
    categories: [{ ...categoryOf(p, 'poste'), name: 'Poste renommé' }, NEW_CATEGORY],
  }

  const merged = (c: Command): ProjectsMerged => {
    const e = decide(p, c)
    if (e?.type !== 'ProjectsMerged') throw new Error('expected a ProjectsMerged event')
    return e
  }

  it('replaces the homonym IN PLACE and appends the new id at the end of ITS category', () => {
    const q = apply(p, merged(contribution))
    // P-99 belongs to 'poste': it lands right after P-02, not at the array end.
    expect(q.projects.map((x) => x.id)).toEqual(['P-01', 'P-02', 'P-99', 'P-03'])
    expect(projectOf(q, 'P-02').goal).toBe(MERGED_P02.goal)
  })

  it('keeps the PRESENT version of a homonym category and appends the unknown one', () => {
    const q = apply(p, merged(contribution))
    // The owner owns the taxonomy: the colleague's rename of 'poste' is dropped.
    expect(q.categories.map((x) => x.name)).toEqual([
      'Infrastructure',
      'Poste de travail',
      'Applications métier',
    ])
  })

  it('never deletes, and leaves review, settings and free slides untouched', () => {
    const q = apply(p, merged(contribution))
    expect(q.projects.length).toBe(p.projects.length + 1)
    // Reference equality: the merge cannot even reach those subtrees — the
    // command carries no review/settings/freeSlides to leak.
    expect(q.review).toBe(p.review)
    expect(q.settings).toBe(p.settings)
    expect(q.freeSlides).toBe(p.freeSlides)
  })

  it('a project of a brand-new category closes the march, its category appended', () => {
    const foreign = { ...NEW_PROJECT, categoryId: NEW_CATEGORY.id }
    const q = apply(
      p,
      merged({ type: 'MergeProjects', projects: [foreign], categories: [NEW_CATEGORY] }),
    )
    expect(q.projects.map((x) => x.id)).toEqual(['P-01', 'P-02', 'P-03', 'P-99'])
    expect(q.categories.map((x) => x.id)).toEqual(['infra', 'poste', 'metier'])
  })

  it('a 100 % homonym contribution with ONE reworked project still emits, in place', () => {
    // The refusal walks `equal` over every incoming/present pair ONLY when all
    // incoming ids are homonyms (merge.ts) — this is the case where that deep
    // walk must say "different" and let the merge through: nothing added, one
    // replacement, order untouched.
    const e = merged({ type: 'MergeProjects', projects: [MERGED_P02], categories: [] })
    expect(mergeReport(e)).toEqual({ replaced: 1, added: 0, createdCategories: 0 })
    const q = apply(p, e)
    expect(q.projects.map((x) => x.id)).toEqual(['P-01', 'P-02', 'P-03'])
    expect(projectOf(q, 'P-02').goal).toBe(MERGED_P02.goal)
    expect(q.categories).toEqual(p.categories)
  })

  it('mergeReport derives the exact figures from the event alone', () => {
    // The same helper feeds the import preview, the post-merge report and the
    // history label: if this breaks, three screens lie at once.
    expect(mergeReport(merged(contribution))).toEqual({
      replaced: 1,
      added: 1,
      createdCategories: 1,
    })
  })
})

/**
 * THE REFUSAL, AS A REASON. `decide` answers `undefined` to three different
 * questions, and a screen that has to tell the user what happened cannot tell
 * them apart from it — a merge strictly void of effect and a merge the budget
 * refuses were the same silence, and the import dialog closed on both.
 */
describe('verdict — the same decision, with the reason attached', () => {
  it('agrees with decide on every sampled variant', () => {
    for (const [name, { command }] of Object.entries(COMMAND_SAMPLES)) {
      const v = verdict(p, command)
      expect(v.ok && v.event, name).toStrictEqual(decide(p, command))
    }
  })

  it('tells the three refusals apart', () => {
    // Nothing to record: the contribution IS the present portfolio.
    expect(verdict(p, { type: 'MergeProjects', projects: p.projects, categories: [] })).toEqual({
      ok: false,
      refusal: 'noEffect',
    })
    // Off contract: the value could not be read back, whatever its size.
    expect(
      verdict(p, {
        type: 'ChangeProjectField',
        id: pid('P-01'),
        field: 'stage',
        after: 'nope',
      } as unknown as Command),
    ).toEqual({ ok: false, refusal: 'offContract' })
    // Over budget: every value is legal, the document they would make is not.
    const heavy = Array.from({ length: 30 }, (_, i) => ({
      ...NEW_PROJECT,
      id: pid(`X-${i}`),
      goal: 'x'.repeat(400_000),
    }))
    expect(verdict(p, { type: 'MergeProjects', projects: heavy, categories: [] })).toEqual({
      ok: false,
      refusal: 'overBudget',
    })
  })
})
