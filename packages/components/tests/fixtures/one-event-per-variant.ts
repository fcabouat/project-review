/**
 * WHY THIS FIXTURE. One minimal event of EVERY `DomainEvent` variant — the
 * bench for `eventLabel`'s totality sweep: the history screen renders
 * whatever the log holds, so no variant may ever yield an empty label or leak
 * a raw catalog key. Values are deliberately tiny (the wording tests own the
 * realistic ones); what matters is covering the union, and the mapped-record
 * type below makes that a COMPILE-TIME fact: adding a variant without its
 * sample here does not build (same discipline as the core's `EVENT_SAMPLES`).
 */
import type { DomainEvent } from '@project-review/core/events'
import { categoryId, freeSlideId } from '@project-review/core/values/ids'
import { otherPortfolio, testPortfolio } from '../../../core/tests/fixtures/hand-built-portfolios'

const slide = {
  id: freeSlideId('s')!,
  anchor: { type: 'closing' },
  title: 'S',
  blocks: [[]],
} as const

/** Exhaustive by type: one key per variant of the union, checked by tsc. */
const BY_TYPE: {
  readonly [T in DomainEvent['type']]: Extract<DomainEvent, { readonly type: T }>
} = {
  ReviewFieldChanged: { type: 'ReviewFieldChanged', field: 'title', before: 'a', after: 'b' },
  IdentityFieldChanged: { type: 'IdentityFieldChanged', field: 'org', before: 'a', after: 'b' },
  SettingChanged: { type: 'SettingChanged', setting: 'recapRows', before: 11, after: 8 },
  CategoryCreated: {
    type: 'CategoryCreated',
    category: { id: categoryId('c')!, name: 'C', color: 'red' },
    index: 0,
  },
  CategoryDeleted: {
    type: 'CategoryDeleted',
    category: { id: categoryId('c')!, name: 'C', color: 'red' },
    index: 0,
  },
  CategoryRenamed: { type: 'CategoryRenamed', id: 'c', before: 'C', after: 'D' },
  CategoryRecolored: { type: 'CategoryRecolored', id: 'c', before: 'red', after: 'blue' },
  CategoryMoved: { type: 'CategoryMoved', id: 'c', from: 0, to: 1 },
  ProjectsChanged: { type: 'ProjectsChanged', before: [], after: [] },
  ProjectCreated: { type: 'ProjectCreated', project: testPortfolio().projects[0]!, index: 0 },
  ProjectDeleted: { type: 'ProjectDeleted', project: testPortfolio().projects[0]!, index: 0 },
  ProjectMoved: { type: 'ProjectMoved', id: 'P-01', from: 0, to: 2 },
  ProjectFieldChanged: {
    type: 'ProjectFieldChanged',
    id: 'P-01',
    field: 'sheet',
    before: 'auto',
    after: 'never',
  },
  ProjectListChanged: {
    type: 'ProjectListChanged',
    id: 'P-01',
    list: 'done',
    before: [],
    after: ['x'],
  },
  ProjectMilestonesChanged: { type: 'ProjectMilestonesChanged', id: 'P-01', before: [], after: [] },
  ProjectDecisionsChanged: {
    type: 'ProjectDecisionsChanged',
    id: 'P-01',
    before: [{ question: 'q' }],
    after: [],
  },
  FreeSlideCreated: { type: 'FreeSlideCreated', slide, index: 0 },
  FreeSlideDeleted: { type: 'FreeSlideDeleted', slide, index: 0 },
  FreeSlideChanged: {
    type: 'FreeSlideChanged',
    id: 's',
    before: slide,
    after: { ...slide, title: 'T' },
  },
  FreeSlideMoved: { type: 'FreeSlideMoved', id: 's', from: 0, to: 1 },
  PortfolioReplaced: {
    type: 'PortfolioReplaced',
    before: testPortfolio(),
    after: otherPortfolio(),
  },
  ProjectsMerged: {
    type: 'ProjectsMerged',
    before: { projects: [{ value: testPortfolio().projects[0]!, index: 0 }], categories: [] },
    after: { projects: [{ value: testPortfolio().projects[0]!, index: 0 }], categories: [] },
  },
}

export const ONE_EVENT_PER_VARIANT: readonly DomainEvent[] = Object.values(BY_TYPE)
