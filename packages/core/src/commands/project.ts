/**
 * Project commands — the intent variants of the central aggregate: target, new
 * value and, for a creation, where to insert (see the commands barrel).
 */
import type { Decision, Milestone, Project } from '../model/project'
import type { NarrativeList, ProjectScalarField } from '../events/project'

/** Insert a complete project at `index`. */
export interface CreateProject {
  readonly type: 'CreateProject'
  readonly project: Project
  readonly index: number
}

export interface DeleteProject {
  readonly type: 'DeleteProject'
  readonly id: string
}

export interface MoveProject {
  readonly type: 'MoveProject'
  readonly id: string
  readonly to: number
}

/** Set one scalar field of a project (one variant per field, typed value). */
export type ChangeProjectField = {
  readonly [F in ProjectScalarField]: {
    readonly type: 'ChangeProjectField'
    readonly id: string
    readonly field: F
    readonly after: Project[F]
  }
}[ProjectScalarField]

/** Replace one narrative list wholesale. */
export interface ChangeProjectList {
  readonly type: 'ChangeProjectList'
  readonly id: string
  readonly list: NarrativeList
  readonly after: readonly string[]
}

/** Replace the milestones wholesale. */
export interface ChangeProjectMilestones {
  readonly type: 'ChangeProjectMilestones'
  readonly id: string
  readonly after: readonly Milestone[]
}

/** Replace the decisions wholesale. */
export interface ChangeProjectDecisions {
  readonly type: 'ChangeProjectDecisions'
  readonly id: string
  readonly after: readonly Decision[]
}
