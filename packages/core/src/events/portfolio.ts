/**
 * Portfolio events — the two global events: a wholesale replacement (import),
 * and a merge of incoming contributions (import in merge mode), both undoable
 * like everything else because both sides ride along.
 */
import type { Category } from '../model/category'
import type { Portfolio } from '../model/portfolio'
import type { Project } from '../model/project'
import type { Positioned } from './collections'

/** Import (and any global replacement): undoable like everything else. */
export interface PortfolioReplaced {
  readonly type: 'PortfolioReplaced'
  readonly before: Portfolio
  readonly after: Portfolio
}

/** The slice of a portfolio a merge touches: projects and categories, each
 * pinned to the index it occupies in the array its side describes. */
export interface MergeSlice {
  readonly projects: readonly Positioned<Project>[]
  readonly categories: readonly Positioned<Category>[]
}

/**
 * Merge of incoming contributions (import in merge mode) — an upsert, never a
 * deletion: an incoming project replaces its homonym in place, a new id joins
 * the end of its category, an unknown incoming category is appended, and a
 * homonym category keeps the PRESENT version (the owner owns the taxonomy).
 *
 * `before` is the affected slice of the present at decision time (replaced
 * projects and concerned existing categories, at their pre-merge index);
 * `after` is the incoming contribution (every incoming project, plus the kept
 * and created categories, at their post-merge index). A concerned existing
 * category appears IDENTICALLY on both sides — the present version won — which
 * is exactly what makes `invert` a plain swap: `apply` (`replaceSlice`)
 * removes what either side names and re-inserts the arrival side, so the
 * mirrored event restores the departure state by construction.
 *
 * The merge numbers shown to the user derive from this event alone —
 * see {@link mergeReport}.
 */
export interface ProjectsMerged {
  readonly type: 'ProjectsMerged'
  readonly before: MergeSlice
  readonly after: MergeSlice
}

/** The figures of one merge, straight from the event — no portfolio needed. */
export interface MergeReport {
  /** Incoming projects that replaced a present homonym, in place. */
  readonly replaced: number
  /** Incoming projects appended at the end of their category. */
  readonly added: number
  /** Incoming categories unknown to the present, appended. */
  readonly createdCategories: number
}

/**
 * Derives the figures of a merge from the event alone — pure, total, shared
 * by the import preview (on the event `decide` completes), the post-merge
 * report and the history label. Lives next to the event it reads, not in
 * projections/: those derive from the PORTFOLIO, this derives from an event.
 */
export const mergeReport = (e: ProjectsMerged): MergeReport => ({
  replaced: e.before.projects.length,
  added: e.after.projects.length - e.before.projects.length,
  createdCategories: e.after.categories.length - e.before.categories.length,
})
