/**
 * Pins the id-uniqueness invariant `src/events/apply.ts` TRUSTS but does not
 * police (it is guaranteed upstream by the strict parse and command contract):
 * a seeded property test drives `apply` with fresh ids on creation and
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
  // Candidate moves; deletions only when a target exists.
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
})
