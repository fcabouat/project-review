/**
 * Free slides — hand-written slides (title + bullet blocks) woven into the
 * generated deck at their anchor.
 *
 * PURE module: no clock, no import beyond values/.
 */
import type { CategoryId, FreeSlideId } from '../values/ids'

/**
 * Where a free slide sits in the deck. 'beforeCategory' with an id that no
 * longer resolves is NOT an error: `deck()` degrades it to the closing
 * position, so entered content never vanishes with a deleted category.
 */
export type Anchor =
  | { readonly type: 'opening' }
  | { readonly type: 'beforeCategory'; readonly categoryId: CategoryId }
  | { readonly type: 'closing' }

/** Hand-written slide (title + bullet blocks) woven into the generated deck at
 * its {@link Anchor}. Ids are minted at the application boundary. */
export interface FreeSlide {
  readonly id: FreeSlideId
  readonly anchor: Anchor
  readonly title: string
  /**
   * At least 1 block (the parse refuses zero); a block = an array of lines
   * (one line = one bullet, in the model/text-line.ts micro-format). The upper
   * length bounds are the forms' concern — the parse does not enforce them.
   */
  readonly blocks: readonly (readonly string[])[]
}
