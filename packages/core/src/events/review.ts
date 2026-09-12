/**
 * Review events — the editable-field vocabulary of the `review` block and its
 * one event: each `Review` field is a text edited on its own, before → after.
 */
import type { Review } from '../model/portfolio'
import type { CoversExactly } from '../values/refine'

/** Every `Review` field is a text editable on its own. */
export type ReviewField = keyof Review

/**
 * Runtime mirror of {@link ReviewField}, in form order. The `_reviewCovered`
 * sentinel below pins it to the type: adding a `Review` field without listing
 * it here is a compile error, so event emitters can iterate this array and
 * still be exhaustive.
 */
export const REVIEW_FIELDS = [
  'title',
  'subtitle',
  'reviewDate',
  'previousReviewDate',
] as const satisfies readonly ReviewField[]

const _reviewCovered: CoversExactly<(typeof REVIEW_FIELDS)[number], ReviewField> = true

/** One review field, before → after (one variant per field). */
export type ReviewFieldChanged = {
  readonly [F in ReviewField]: {
    readonly type: 'ReviewFieldChanged'
    readonly field: F
    readonly before: Review[F]
    readonly after: Review[F]
  }
}[ReviewField]
