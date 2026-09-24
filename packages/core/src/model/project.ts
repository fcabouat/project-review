/**
 * Projects — the central aggregate: one project,
 * one sheet slide, one recap row; its decisions and milestones ride along as
 * plain row collections.
 *
 * PURE module: no clock — the only reference date anywhere is
 * `review.reviewDate`; ISO dates compare lexicographically (values/date.ts).
 */
import type { CategoryId, ProjectId } from '../values/ids'
import type { IsoDate } from '../values/date'
import type { Progress } from '../values/progress'

/** Lifecycle stage, in chronological order; the two groupings that
 * matter are {@link PRE_PROJECT_STAGES} and {@link ARCHIVED_STAGES}. */
export type Stage = 'toScope' | 'ready' | 'inProgress' | 'residuals' | 'closed' | 'abandoned'

/** Subjective health, best to worst. There is no 'notAssessed' member: absence
 * of the optional `Project.health` IS the not-assessed state. */
export type HealthLevel = 'onTrack' | 'watch' | 'alert' | 'critical'

/** P1 = highest. Display-only ranking (badge and recap column) — no derivation
 * sorts or filters on it. */
export type Priority = 'P1' | 'P2' | 'P3'

/** Per-project override of the detail slide: 'auto' lets `showsSheet` decide
 * from stage and pending decisions, 'always'/'never' forces it. */
export type SheetMode = 'auto' | 'always' | 'never'

/** A settled decision — text AND date, all or nothing: the parse refuses a
 * half-filled outcome rather than invent one. */
export interface DecisionOutcome {
  readonly text: string
  readonly when: IsoDate
}

/**
 * One question brought to a review. "Pending" is not a stored flag: it is
 * `taken === undefined`, so settling a decision never desynchronizes a status
 * field. Decisions carry no id — they are addressed positionally
 * (`DecisionRef`, projections/slide.ts) and replaced wholesale by the edit events.
 */
export interface Decision {
  readonly question: string
  readonly decider?: string
  readonly taken?: DecisionOutcome
}

/**
 * A dated step on the project timeline. `date` drives everything computed
 * (overdue state, axis position); `display`, when present, replaces the
 * FORMATTED date on screen — "T2 2027" where a day-precise date would claim
 * false precision. `done` is asserted by the editor, never inferred from the
 * review date.
 */
export interface Milestone {
  readonly label: string
  readonly date: IsoDate
  readonly display?: string
  readonly done: boolean
}

/**
 * The central aggregate — one project, one sheet slide, one recap row. Absence
 * of an optional field is meaningful display state ("not assessed" health, "—"
 * priority), never a default to fill in. Scalars are edited one by one
 * (`ProjectFieldChanged`); the three narrative lists and the two row
 * collections are replaced wholesale. `id` is an immutable technical identity,
 * preserved across exports. The optional reference is display-only.
 */
export interface Project {
  readonly id: ProjectId
  readonly reference?: string
  readonly name: string
  readonly categoryId: CategoryId
  readonly priority?: Priority
  readonly stage: Stage
  readonly onHold: boolean
  readonly health?: HealthLevel
  readonly progress?: Progress
  readonly lead?: string
  readonly sponsor?: string
  /** Optional free-text context, independent from the shared tags. */
  readonly scope?: string
  readonly scopeTags?: readonly string[]
  readonly goal: string
  readonly budget?: string
  readonly start?: IsoDate
  readonly targetEnd?: IsoDate
  readonly actualEnd?: IsoDate
  readonly done: readonly string[]
  readonly ongoing: readonly string[]
  readonly next: readonly string[]
  readonly risks?: string
  readonly decisions: readonly Decision[]
  readonly milestones: readonly Milestone[]
  readonly sheet: SheetMode
  readonly updatedOn?: IsoDate
  readonly author?: string
}

/** Every {@link Stage}, in lifecycle order — the order the forms offer them. */
export const STAGES: readonly Stage[] = [
  'toScope',
  'ready',
  'inProgress',
  'residuals',
  'closed',
  'abandoned',
]

/** Every {@link HealthLevel}, best to worst. */
export const HEALTH_LEVELS: readonly HealthLevel[] = ['onTrack', 'watch', 'alert', 'critical']

/** Every {@link Priority}, highest first. */
export const PRIORITIES: readonly Priority[] = ['P1', 'P2', 'P3']

/** Every {@link SheetMode}, in segmented-control order ('auto' first: the
 * default). */
export const SHEET_MODES: readonly SheetMode[] = ['auto', 'always', 'never']

/** Stage groups — the only end-of-life notion is "archived". */
export const PRE_PROJECT_STAGES: readonly Stage[] = ['toScope', 'ready']
export const ARCHIVED_STAGES: readonly Stage[] = ['closed', 'abandoned']
