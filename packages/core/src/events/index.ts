/**
 * Edit events — the `DomainEvent` union, routed by aggregate: one
 * module per aggregate for the variants and their field vocabulary, and the
 * central machinery next door (`apply`, `invert`, `collections`).
 *
 * Three design rules:
 *  1. Every event carries what it needs to invert itself (`before`/`after`, or
 *     complete data + insertion index). `invert` is therefore pure: it never
 *     consults the portfolio.
 *  2. Routing is ALWAYS done by identifier (the current id at apply time). The
 *     indexes carried around only serve to re-insert at the right place when
 *     inverting — never to look an element up.
 *  3. `apply` is TOTAL: an inapplicable event (id not found) leaves the
 *     portfolio unchanged, without throwing.
 *
 * PURE modules throughout: no Svelte/DOM import, no clock. Events carry no
 * timestamp (the time shown by the history belongs to the UI, not to the
 * core). A truthful `before` is the emitter's concern — `decide` (commands/)
 * builds one by construction.
 */
import type { ReviewFieldChanged } from './review'
import type { IdentityFieldChanged, SettingChanged } from './settings'
import type {
  CategoryCreated,
  CategoryDeleted,
  CategoryMoved,
  CategoryRecolored,
  CategoryRenamed,
} from './category'
import type {
  ProjectCreated,
  ProjectDecisionsChanged,
  ProjectDeleted,
  ProjectFieldChanged,
  ProjectListChanged,
  ProjectMilestonesChanged,
  ProjectMoved,
  ProjectRenumbered,
} from './project'
import type {
  FreeSlideChanged,
  FreeSlideCreated,
  FreeSlideDeleted,
  FreeSlideMoved,
} from './free-slide'
import type { PortfolioReplaced, ProjectsMerged } from './portfolio'

export * from './review'
export * from './settings'
export * from './category'
export * from './project'
export * from './free-slide'
export * from './portfolio'
export * from './collections'
export * from './apply'
export * from './invert'

/**
 * The closed union the store, the persisted history and the History screen all
 * share. Adding a variant means teaching FOUR functions: `apply` (apply.ts)
 * and `invert` (invert.ts) — both pinned by a `never` sentinel —, `decide`
 * with its `Command` mirror (commands/, pinned too), and `eventLabel` in the
 * components' `editor/event-label.ts` (pinned too) — plus bumping
 * `STATE_FORMAT` (services/persistence.ts) if the change breaks replay of
 * stored events.
 */
export type DomainEvent =
  | ReviewFieldChanged
  | IdentityFieldChanged
  | SettingChanged
  | CategoryCreated
  | CategoryDeleted
  | CategoryRenamed
  | CategoryRecolored
  | CategoryMoved
  | ProjectCreated
  | ProjectDeleted
  | ProjectMoved
  | ProjectRenumbered
  | ProjectFieldChanged
  | ProjectListChanged
  | ProjectMilestonesChanged
  | ProjectDecisionsChanged
  | FreeSlideCreated
  | FreeSlideDeleted
  | FreeSlideChanged
  | FreeSlideMoved
  | PortfolioReplaced
  | ProjectsMerged
