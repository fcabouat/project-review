/**
 * Deck vocabulary — the slide types the deck derivation emits,
 * each constructor = one template. Everything here is DERIVED (recomputed by
 * `deck()`, projections/deck.ts — never stored), so slides hold ids and page
 * splits, not copies of the content: the template reads the live portfolio
 * through them.
 *
 * PURE module: types only.
 */

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
  | { readonly type: 'divider'; readonly categoryId: string; readonly number: number }
  | { readonly type: 'sheet'; readonly projectId: string }
  /** Today's table, paginated by 7; the "page i / n" mention shows only when totalPages > 1. */
  | {
      readonly type: 'decisions'
      readonly page: number
      readonly totalPages: number
      readonly entries: readonly DecisionRef[]
    }
  /** Closed and abandoned projects. */
  | { readonly type: 'archives' }
  /** Record of the previous review — read-only appendix, very last slide apart from closing free slides. */
  | { readonly type: 'previousDecisions' }
