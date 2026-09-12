/**
 * Deck vocabulary — the slide types the deck derivation emits,
 * each constructor = one template. Everything here is DERIVED (recomputed by
 * `deck()`, ./deck.ts — never stored), so slides hold ids and page splits,
 * not copies of the content: the template reads the live portfolio through
 * them. It lives in projections/, not model/: a `Slide` never appears in a
 * portfolio, an event or a command — it only ever comes OUT of a projection.
 *
 * PURE module: types only.
 */
import type { GroupRef } from './projects'

/** Reference to a decision: the project and the index in its `decisions` array. */
export interface DecisionRef {
  readonly projectId: string
  readonly index: number
}

/** One deck slide — a template selector plus the minimum data to render it. */
export type Slide =
  | { readonly type: 'title' }
  | { readonly type: 'freeform'; readonly slideId: string }
  | { readonly type: 'portfolioDashboard' }
  | { readonly type: 'healthDashboard' }
  | {
      readonly type: 'recap'
      readonly page: number
      readonly totalPages: number
      readonly projectIds: readonly string[]
    }
  /** Section opener: WHICH group it announces (a category, or the orphan
   * residue — `GroupRef`, never an id that both could answer to) and its rank. */
  | { readonly type: 'divider'; readonly group: GroupRef; readonly number: number }
  | { readonly type: 'sheet'; readonly projectId: string }
  /** Today's table, paginated by 7; the "page i / n" mention shows only when totalPages > 1. */
  | {
      readonly type: 'decisions'
      readonly page: number
      readonly totalPages: number
      readonly entries: readonly DecisionRef[]
    }
  /** Closed and abandoned projects, paginated in declaration order. */
  | {
      readonly type: 'archives'
      readonly page: number
      readonly totalPages: number
      readonly projectIds: readonly string[]
    }
  /** Settled decisions since the previous review, paginated in portfolio order. */
  | {
      readonly type: 'previousDecisions'
      readonly page: number
      readonly totalPages: number
      readonly entries: readonly DecisionRef[]
    }
