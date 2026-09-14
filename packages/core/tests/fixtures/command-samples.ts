/**
 * WHY THIS FIXTURE. One `{ command, event }` pair per command variant,
 * EXHAUSTIVE over the `Command` union: the table is typed
 * `{ [T in Command['type']]: … }`, so a new command cannot ship unsampled.
 * Each pair states the completed event `decide` must produce — every `before`
 * and `from` is spelled out from what `testPortfolio()` actually holds, so a
 * `decide` that stopped reading the true present fails against these pairs.
 */

import { isoDate } from '../../src/values/date'
import { projectId } from '../../src/values/ids'
import { progressOf } from '../../src/values/progress'
import type { DomainEvent } from '../../src/events/index'
import type { Command } from '../../src/commands/index'
import {
  MERGED_P02,
  NEW_CATEGORY,
  NEW_PROJECT,
  NEW_SLIDE,
  categoryOf,
  otherPortfolio,
  projectOf,
  slideOf,
  testPortfolio,
} from './hand-built-portfolios'

const d = (x: string) => isoDate(x)!
const pid = (x: string) => projectId(x)!

/** The portfolio every pair's `before` is read from. */
const p = testPortfolio()

export type CommandSamples = {
  readonly [T in Command['type']]: {
    readonly command: Extract<Command, { readonly type: T }>
    readonly event: DomainEvent
  }
}

export const COMMAND_SAMPLES: CommandSamples = {
  ChangeReviewField: {
    command: { type: 'ChangeReviewField', field: 'title', after: 'Revue remaniée' },
    event: {
      type: 'ReviewFieldChanged',
      field: 'title',
      before: 'Revue des projets',
      after: 'Revue remaniée',
    },
  },
  ChangeIdentityField: {
    command: { type: 'ChangeIdentityField', field: 'unit', after: 'DSI adjointe' },
    event: { type: 'IdentityFieldChanged', field: 'unit', before: 'DSI', after: 'DSI adjointe' },
  },
  ChangeSetting: {
    command: { type: 'ChangeSetting', setting: 'palette', after: 'material' },
    event: { type: 'SettingChanged', setting: 'palette', before: 'tailwind', after: 'material' },
  },
  CreateCategory: {
    command: { type: 'CreateCategory', category: NEW_CATEGORY, index: 1 },
    event: { type: 'CategoryCreated', category: NEW_CATEGORY, index: 1 },
  },
  DeleteCategory: {
    command: { type: 'DeleteCategory', id: 'poste' },
    event: { type: 'CategoryDeleted', category: categoryOf(p, 'poste'), index: 1 },
  },
  RenameCategory: {
    command: { type: 'RenameCategory', id: 'infra', after: 'Socle technique' },
    event: {
      type: 'CategoryRenamed',
      id: 'infra',
      before: 'Infrastructure',
      after: 'Socle technique',
    },
  },
  RecolorCategory: {
    command: { type: 'RecolorCategory', id: 'poste', after: 'orange' },
    event: { type: 'CategoryRecolored', id: 'poste', before: 'green', after: 'orange' },
  },
  MoveCategory: {
    command: { type: 'MoveCategory', id: 'infra', to: 1 },
    event: { type: 'CategoryMoved', id: 'infra', from: 0, to: 1 },
  },
  CreateProject: {
    command: { type: 'CreateProject', project: NEW_PROJECT, index: 3 },
    event: { type: 'ProjectCreated', project: NEW_PROJECT, index: 3 },
  },
  DeleteProject: {
    command: { type: 'DeleteProject', id: 'P-03' },
    event: { type: 'ProjectDeleted', project: projectOf(p, 'P-03'), index: 2 },
  },
  MoveProject: {
    command: { type: 'MoveProject', id: 'P-01', to: 2 },
    event: { type: 'ProjectMoved', id: 'P-01', from: 0, to: 2 },
  },
  RenumberProject: {
    command: { type: 'RenumberProject', id: pid('P-01'), newId: pid('P-99') },
    event: { type: 'ProjectRenumbered', oldId: pid('P-01'), newId: pid('P-99') },
  },
  ChangeProjectField: {
    command: { type: 'ChangeProjectField', id: 'P-01', field: 'progress', after: progressOf(75)! },
    event: {
      type: 'ProjectFieldChanged',
      id: 'P-01',
      field: 'progress',
      before: progressOf(60)!,
      after: progressOf(75)!,
    },
  },
  ChangeProjectList: {
    command: { type: 'ChangeProjectList', id: 'P-02', list: 'done', after: ['première puce'] },
    event: {
      type: 'ProjectListChanged',
      id: 'P-02',
      list: 'done',
      before: [],
      after: ['première puce'],
    },
  },
  ChangeProjectMilestones: {
    command: {
      type: 'ChangeProjectMilestones',
      id: 'P-02',
      after: [{ label: 'Cadrage validé', date: d('2026-10-01'), done: false }],
    },
    event: {
      type: 'ProjectMilestonesChanged',
      id: 'P-02',
      before: [],
      after: [{ label: 'Cadrage validé', date: d('2026-10-01'), done: false }],
    },
  },
  ChangeProjectDecisions: {
    command: { type: 'ChangeProjectDecisions', id: 'P-02', after: [{ question: 'Q ?' }] },
    event: {
      type: 'ProjectDecisionsChanged',
      id: 'P-02',
      before: [],
      after: [{ question: 'Q ?' }],
    },
  },
  CreateFreeSlide: {
    command: { type: 'CreateFreeSlide', slide: NEW_SLIDE, index: 1 },
    event: { type: 'FreeSlideCreated', slide: NEW_SLIDE, index: 1 },
  },
  DeleteFreeSlide: {
    command: { type: 'DeleteFreeSlide', id: 'opening' },
    event: { type: 'FreeSlideDeleted', slide: slideOf(p, 'opening'), index: 0 },
  },
  ChangeFreeSlide: {
    command: {
      type: 'ChangeFreeSlide',
      id: 'opening',
      after: { ...slideOf(p, 'opening'), title: 'Ouverture remaniée' },
    },
    event: {
      type: 'FreeSlideChanged',
      id: 'opening',
      before: slideOf(p, 'opening'),
      after: { ...slideOf(p, 'opening'), title: 'Ouverture remaniée' },
    },
  },
  MoveFreeSlide: {
    command: { type: 'MoveFreeSlide', id: 'opening', to: 3 },
    event: { type: 'FreeSlideMoved', id: 'opening', from: 0, to: 3 },
  },
  ReplacePortfolio: {
    command: { type: 'ReplacePortfolio', portfolio: otherPortfolio() },
    event: { type: 'PortfolioReplaced', before: p, after: otherPortfolio() },
  },
  // A full-shaped merge: P-02 replaced in place, P-99 added at the end of its
  // category ('poste' — after P-02, hence final index 2, before P-03), the
  // homonym category 'poste' kept as the PRESENT version on both sides (the
  // incoming rename must NOT win), and a new category appended.
  MergeProjects: {
    command: {
      type: 'MergeProjects',
      projects: [MERGED_P02, NEW_PROJECT],
      categories: [
        { ...categoryOf(p, 'poste'), name: 'Poste renommé par le collègue' },
        NEW_CATEGORY,
      ],
    },
    event: {
      type: 'ProjectsMerged',
      before: {
        projects: [{ value: projectOf(p, 'P-02'), index: 1 }],
        categories: [{ value: categoryOf(p, 'poste'), index: 1 }],
      },
      after: {
        projects: [
          { value: MERGED_P02, index: 1 },
          { value: NEW_PROJECT, index: 2 },
        ],
        categories: [
          { value: categoryOf(p, 'poste'), index: 1 },
          { value: NEW_CATEGORY, index: 2 },
        ],
      },
    },
  },
}
