/**
 * Project events — the editable-field vocabulary of the central aggregate and
 * its eight events: whole-project creation/deletion/move, the one-scalar edit,
 * and the three wholesale list replacements.
 */
import type { IsoDate } from '../values/date'
import type { Project } from '../model/project'
import type { Decision, Milestone } from '../model/project'
import type { CoversExactly } from '../values/refine'

/** `Project` fields editable one by one: everything but the id and the lists. */
export type ProjectScalarField = Exclude<
  keyof Project,
  'id' | 'done' | 'ongoing' | 'next' | 'decisions' | 'milestones'
>

/** Runtime mirror of {@link ProjectScalarField}, in sheet-form order — same
 * compile-time coverage pin as `REVIEW_FIELDS` (review.ts). */
export const PROJECT_SCALAR_FIELDS = [
  'reference',
  'name',
  'categoryId',
  'priority',
  'stage',
  'onHold',
  'health',
  'progress',
  'lead',
  'sponsor',
  'scope',
  'scopeTags',
  'goal',
  'budget',
  'start',
  'targetEnd',
  'actualEnd',
  'risks',
  'sheet',
  'updatedOn',
  'author',
] as const satisfies readonly ProjectScalarField[]

const _projectCovered: CoversExactly<(typeof PROJECT_SCALAR_FIELDS)[number], ProjectScalarField> =
  true

/** The three bullet lists of the review narrative, replaced wholesale. */
export type NarrativeList = 'done' | 'ongoing' | 'next'

/** Runtime mirror of {@link NarrativeList}, in the sheet's display order. */
export const NARRATIVE_LISTS = [
  'done',
  'ongoing',
  'next',
] as const satisfies readonly NarrativeList[]

/** Complete project + insertion index, like `CategoryCreated`. */
export interface ProjectCreated {
  readonly type: 'ProjectCreated'
  readonly project: Project
  readonly index: number
}

/**
 * The whole project rides along — narrative lists, decisions and milestones
 * included — which is what makes a deletion undoable in one step.
 */
export interface ProjectDeleted {
  readonly type: 'ProjectDeleted'
  readonly project: Project
  readonly index: number
}

/** Same `splice` semantics as `CategoryMoved`. */
export interface ProjectMoved {
  readonly type: 'ProjectMoved'
  readonly id: string
  readonly from: number
  readonly to: number
}

/** One scalar field of a project (one variant per field, typed values). */
export type ProjectFieldChanged = {
  readonly [F in ProjectScalarField]: {
    readonly modified?: ProjectModification
    readonly type: 'ProjectFieldChanged'
    readonly id: string
    readonly field: F
    readonly before: Project[F]
    readonly after: Project[F]
  }
}[ProjectScalarField]

/** A whole bullet list replaced (addition, removal and reordering). */
export interface ProjectListChanged {
  readonly modified?: ProjectModification
  readonly type: 'ProjectListChanged'
  readonly id: string
  readonly list: NarrativeList
  readonly before: readonly string[]
  readonly after: readonly string[]
}

/**
 * Milestones are replaced wholesale, like the narrative lists: one form gesture
 * (edit, add, remove, reorder) = one event = one undo step, and rows need no id
 * of their own.
 */
export interface ProjectMilestonesChanged {
  readonly modified?: ProjectModification
  readonly type: 'ProjectMilestonesChanged'
  readonly id: string
  readonly before: readonly Milestone[]
  readonly after: readonly Milestone[]
}

/** Wholesale replacement — same rationale as {@link ProjectMilestonesChanged}. */
export interface ProjectDecisionsChanged {
  readonly modified?: ProjectModification
  readonly type: 'ProjectDecisionsChanged'
  readonly id: string
  readonly before: readonly Decision[]
  readonly after: readonly Decision[]
}

/** Supplied by the host; the domain never consults a clock. */
export interface ProjectModification {
  readonly before?: IsoDate
  readonly after?: IsoDate
}
/** Only changed projects; identities and order remain stable. */
export interface ProjectsChanged {
  readonly type: 'ProjectsChanged'
  readonly before: readonly Project[]
  readonly after: readonly Project[]
}
