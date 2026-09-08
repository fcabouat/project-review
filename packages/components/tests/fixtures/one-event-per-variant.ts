/**
 * WHY THIS FIXTURE. One minimal event of EVERY `DomainEvent` variant — the
 * bench for `eventLabel`'s totality sweep: the history screen renders
 * whatever the log holds, so no variant may ever yield an empty label or leak
 * a raw catalog key. Values are deliberately tiny (the wording tests own the
 * realistic ones); what matters here is covering the union, and the compiler
 * cannot enforce it on a plain array — keep this list in step with
 * `DomainEvent` (the core's `EVENT_SAMPLES` table is the type-checked twin).
 */
import type { DomainEvent } from '@project-review/core/events'
import { categoryId, freeSlideId, projectId } from '@project-review/core/values/ids'
import { otherPortfolio, testPortfolio } from '../../../core/tests/fixtures/hand-built-portfolios'

const slide = {
  id: freeSlideId('s')!,
  anchor: { type: 'closing' },
  title: 'S',
  blocks: [[]],
} as const

export const ONE_EVENT_PER_VARIANT: readonly DomainEvent[] = [
  { type: 'ReviewFieldChanged', field: 'title', before: 'a', after: 'b' },
  { type: 'IdentityFieldChanged', field: 'org', before: 'a', after: 'b' },
  { type: 'SettingChanged', setting: 'recapRows', before: 11, after: 8 },
  {
    type: 'CategoryCreated',
    category: { id: categoryId('c')!, name: 'C', color: 'red' },
    index: 0,
  },
  {
    type: 'CategoryDeleted',
    category: { id: categoryId('c')!, name: 'C', color: 'red' },
    index: 0,
  },
  { type: 'CategoryRenamed', id: 'c', before: 'C', after: 'D' },
  { type: 'CategoryRecolored', id: 'c', before: 'red', after: 'blue' },
  { type: 'CategoryMoved', id: 'c', from: 0, to: 1 },
  { type: 'ProjectCreated', project: testPortfolio().projects[0]!, index: 0 },
  { type: 'ProjectDeleted', project: testPortfolio().projects[0]!, index: 0 },
  { type: 'ProjectMoved', id: 'P-01', from: 0, to: 2 },
  { type: 'ProjectRenumbered', oldId: projectId('P-01')!, newId: projectId('P-99')! },
  { type: 'ProjectFieldChanged', id: 'P-01', field: 'sheet', before: 'auto', after: 'never' },
  { type: 'ProjectListChanged', id: 'P-01', list: 'done', before: [], after: ['x'] },
  { type: 'ProjectMilestonesChanged', id: 'P-01', before: [], after: [] },
  { type: 'ProjectDecisionsChanged', id: 'P-01', before: [{ question: 'q' }], after: [] },
  { type: 'FreeSlideCreated', slide, index: 0 },
  { type: 'FreeSlideDeleted', slide, index: 0 },
  { type: 'FreeSlideChanged', id: 's', before: slide, after: { ...slide, title: 'T' } },
  { type: 'FreeSlideMoved', id: 's', from: 0, to: 1 },
  { type: 'PortfolioReplaced', before: testPortfolio(), after: otherPortfolio() },
  {
    type: 'ProjectsMerged',
    before: { projects: [{ value: testPortfolio().projects[0]!, index: 0 }], categories: [] },
    after: { projects: [{ value: testPortfolio().projects[0]!, index: 0 }], categories: [] },
  },
]
