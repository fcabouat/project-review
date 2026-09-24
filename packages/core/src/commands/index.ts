/**
 * Commands — the intent half of the edit pipeline (docs/overview.md, the loop): each
 * variant IS one USE-CASE of the application (rename a project, settle a
 * decision, …). A `Command` is a `DomainEvent` stripped of everything the
 * emitter should not have to know: no `before`, no `from` — only the target,
 * the new value and, for creations, where to insert. The HANDLERS of these
 * use-cases are the per-aggregate rules `decide` (decide.ts) applies to
 * complete an intent into a full event by reading the current portfolio, so
 * the `before` carried by every produced event is true BY CONSTRUCTION; the
 * application service that runs them is `runtime/editing.ts`.
 *
 * One variant per event variant — the private `EVENT_FOR` table pins the
 * mirror at compile time in both directions.
 */
import type { CoversExactly } from '../values/refine'
import type { DomainEvent } from '../events/index'
import type { ChangeReviewField } from './review'
import type { ChangeIdentityField, ChangeSetting } from './settings'
import type {
  CreateCategory,
  DeleteCategory,
  MoveCategory,
  RecolorCategory,
  RenameCategory,
} from './category'
import type {
  ChangeProjects,
  ChangeProjectDecisions,
  ChangeProjectField,
  ChangeProjectList,
  ChangeProjectMilestones,
  CreateProject,
  DeleteProject,
  MoveProject,
} from './project'
import type { ChangeFreeSlide, CreateFreeSlide, DeleteFreeSlide, MoveFreeSlide } from './free-slide'
import type { MergeProjects, ReplacePortfolio } from './portfolio'

export * from './review'
export * from './settings'
export * from './category'
export * from './project'
export * from './free-slide'
export * from './portfolio'
export * from './decide'

/** The closed union of intents `decide` accepts — mirror of `DomainEvent`. */
export type Command =
  | ChangeReviewField
  | ChangeIdentityField
  | ChangeSetting
  | CreateCategory
  | DeleteCategory
  | RenameCategory
  | RecolorCategory
  | MoveCategory
  | CreateProject
  | DeleteProject
  | MoveProject
  | ChangeProjects
  | ChangeProjectField
  | ChangeProjectList
  | ChangeProjectMilestones
  | ChangeProjectDecisions
  | CreateFreeSlide
  | DeleteFreeSlide
  | ChangeFreeSlide
  | MoveFreeSlide
  | ReplacePortfolio
  | MergeProjects

/**
 * Command ↔ event mirror, pinned at compile time: the `satisfies` clause
 * demands one event type per command, and the sentinel below demands that the
 * table's values exhaust the event union — so neither side can grow alone.
 */
const _EVENT_FOR = {
  ChangeReviewField: 'ReviewFieldChanged',
  ChangeIdentityField: 'IdentityFieldChanged',
  ChangeSetting: 'SettingChanged',
  CreateCategory: 'CategoryCreated',
  DeleteCategory: 'CategoryDeleted',
  RenameCategory: 'CategoryRenamed',
  RecolorCategory: 'CategoryRecolored',
  MoveCategory: 'CategoryMoved',
  CreateProject: 'ProjectCreated',
  DeleteProject: 'ProjectDeleted',
  MoveProject: 'ProjectMoved',
  ChangeProjects: 'ProjectsChanged',
  ChangeProjectField: 'ProjectFieldChanged',
  ChangeProjectList: 'ProjectListChanged',
  ChangeProjectMilestones: 'ProjectMilestonesChanged',
  ChangeProjectDecisions: 'ProjectDecisionsChanged',
  CreateFreeSlide: 'FreeSlideCreated',
  DeleteFreeSlide: 'FreeSlideDeleted',
  ChangeFreeSlide: 'FreeSlideChanged',
  MoveFreeSlide: 'FreeSlideMoved',
  ReplacePortfolio: 'PortfolioReplaced',
  MergeProjects: 'ProjectsMerged',
} as const satisfies Record<Command['type'], DomainEvent['type']>

const _everyEventReachable: CoversExactly<
  (typeof _EVENT_FOR)[keyof typeof _EVENT_FOR],
  DomainEvent['type']
> = true
