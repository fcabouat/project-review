/**
 * Pins the id-uniqueness invariant `src/events/apply.ts` TRUSTS but does not
 * police (it is guaranteed upstream by the strict parse, deterministic minting
 * and `decide`'s renumber refusal): a seeded property test drives `apply` the
 * way the views do — fresh ids on creation, free ids on renumbering — and
 * asserts after EVERY step that ids stay unique per collection.
 */

import { describe, expect, it } from 'vitest'
import type { Category } from '../../src/model/category'
import type { FreeSlide } from '../../src/model/free-slide'
import type { Portfolio } from '../../src/model/portfolio'
import type { Project } from '../../src/model/project'
import type { CategoryId, FreeSlideId, ProjectId } from '../../src/values/ids'
import { categoryId, freeSlideId, projectId } from '../../src/values/ids'
import { apply, type DomainEvent } from '../../src/events/index'
import { otherPortfolio, testPortfolio } from '../fixtures/hand-built-portfolios'
import { intBelow, mulberry32, pick, type Rng } from '../fixtures/seeded-random'

/* ------------------------------------------------------------------ */
/* Element factories — minimal shapes, fresh ids like the views mint   */
/* ------------------------------------------------------------------ */

let counter = 0

/** Fresh id, never colliding with anything the run created or imported. */
const freshId = (prefix: string): string => `${prefix}-${(counter += 1)}`

const makeCategory = (id: CategoryId): Category => ({ id, name: `Cat ${id}`, color: 'blue' })

const makeProject = (id: ProjectId, categoryId: CategoryId): Project => ({
  id,
  name: `Projet ${id}`,
  categoryId,
  stage: 'ready',
  onHold: false,
  goal: 'Invariant d’unicité.',
  done: [],
  ongoing: [],
  next: [],
  decisions: [],
  milestones: [],
  sheet: 'auto',
})

const makeSlide = (id: FreeSlideId): FreeSlide => ({
  id,
  anchor: { type: 'closing' },
  title: `Libre ${id}`,
  blocks: [['Une ligne']],
})

/* ------------------------------------------------------------------ */
/* One random step, conditioned on the current portfolio               */
/* ------------------------------------------------------------------ */

const randomEvent = (rng: Rng, p: Portfolio): DomainEvent => {
  // Candidate moves; deletions and renumbering only when a target exists.
  const moves: (() => DomainEvent)[] = [
    () => ({
      type: 'CategoryCreated',
      category: makeCategory(categoryId(freshId('cat'))!),
      index: intBelow(rng, p.categories.length + 1),
    }),
    () => ({
      type: 'ProjectCreated',
      project: makeProject(
        projectId(freshId('P'))!,
        p.categories.length > 0 ? pick(rng, p.categories).id : categoryId('divers')!,
      ),
      index: intBelow(rng, p.projects.length + 1),
    }),
    () => ({
      type: 'FreeSlideCreated',
      slide: makeSlide(freeSlideId(freshId('free'))!),
      index: intBelow(rng, p.freeSlides.length + 1),
    }),
    // Import: one PortfolioReplaced, like ImportExportDialog dispatches.
    () => ({
      type: 'PortfolioReplaced',
      before: p,
      after: rng() < 0.5 ? otherPortfolio() : testPortfolio(),
    }),
  ]
  if (p.categories.length > 0)
    moves.push(() => {
      const i = intBelow(rng, p.categories.length)
      const category = p.categories[i]
      if (category === undefined) throw new Error('unreachable')
      return { type: 'CategoryDeleted', category, index: i }
    })
  if (p.projects.length > 0) {
    moves.push(() => {
      const i = intBelow(rng, p.projects.length)
      const project = p.projects[i]
      if (project === undefined) throw new Error('unreachable')
      return { type: 'ProjectDeleted', project, index: i }
    })
    // Renumbering to a FREE id — the only renumbering the app can dispatch
    // (SheetView refuses a taken id before dispatching).
    moves.push(() => ({
      type: 'ProjectRenumbered',
      oldId: pick(rng, p.projects).id,
      newId: projectId(freshId('P'))!,
    }))
  }
  if (p.freeSlides.length > 0)
    moves.push(() => {
      const i = intBelow(rng, p.freeSlides.length)
      const slide = p.freeSlides[i]
      if (slide === undefined) throw new Error('unreachable')
      return { type: 'FreeSlideDeleted', slide, index: i }
    })
  return pick(rng, moves)()
}

const expectUniqueIds = (p: Portfolio): void => {
  for (const collection of [p.categories, p.projects, p.freeSlides] as const) {
    const ids = collection.map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  }
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('id uniqueness per collection — property', () => {
  it('holds after every step of 50 random 40-event sequences (seed 2026)', () => {
    for (let run = 0; run < 50; run += 1) {
      const rng = mulberry32(2026 + run)
      let p = testPortfolio()
      expectUniqueIds(p)
      for (let step = 0; step < 40; step += 1) {
        p = apply(p, randomEvent(rng, p))
        expectUniqueIds(p)
      }
    }
  })

  it('ProjectRenumbered to a taken id: apply alone duplicates (guard lives in decide)', () => {
    // Observed behaviour, documented as it is: `apply` routes by `oldId` and
    // never checks the arrival id, so renumbering P-02 to P-01 yields TWO
    // projects named P-01. In the app this event is unreachable — `decide`
    // refuses the RenumberProject intent when the id is taken (nothing is
    // recorded; the sheet screen alerts) — and the invariant header of the
    // events barrel states why it must stay so: duplicates would break
    // `apply ∘ invert`.
    const after = apply(testPortfolio(), {
      type: 'ProjectRenumbered',
      oldId: projectId('P-02')!,
      newId: projectId('P-01')!,
    })
    expect(after.projects.map((x) => x.id)).toStrictEqual(['P-01', 'P-01', 'P-03'])
  })
})
