/**
 * Review commands — the intent variants of the `review` block: one variant per
 * field, typed value, no `before` (see the commands barrel, index.ts).
 */
import type { Review } from '../model/portfolio'
import type { ReviewField } from '../events/review'

/** Set one review field (one variant per field, typed value). */
export type ChangeReviewField = {
  readonly [F in ReviewField]: {
    readonly type: 'ChangeReviewField'
    readonly field: F
    readonly after: Review[F]
  }
}[ReviewField]
