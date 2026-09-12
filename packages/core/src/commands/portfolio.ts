/**
 * Portfolio commands — the two global intents: replace everything (import),
 * or merge incoming contributions into the present (import in merge mode).
 */
import type { Category } from '../model/category'
import type { Portfolio } from '../model/portfolio'
import type { Project } from '../model/project'

/** Global replacement (import) — carries only the NEW portfolio; `decide`
 * fills `before` with the present one. */
export interface ReplacePortfolio {
  readonly type: 'ReplacePortfolio'
  readonly portfolio: Portfolio
}

/**
 * Merge of a colleague's contribution — carries only what the incoming file
 * says that matters to a merge: its projects and its categories (review,
 * settings and free slides of the incoming file are the sender's context, not
 * content to merge). `decide` completes it into a positioned
 * `ProjectsMerged` by reading the present (commands/merge.ts states the
 * rules: upsert in place, append at end of category, never delete).
 */
export interface MergeProjects {
  readonly type: 'MergeProjects'
  readonly projects: readonly Project[]
  readonly categories: readonly Category[]
}
