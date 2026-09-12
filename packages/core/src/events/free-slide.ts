/**
 * Free-slide events — creation/deletion carry the COMPLETE slide plus its
 * position (design rule 1, index.ts); an edit replaces the whole slide (title,
 * anchor and blocks move together — and possibly its id).
 */
import type { FreeSlide } from '../model/free-slide'

/** Complete slide + insertion index, like `CategoryCreated`. */
export interface FreeSlideCreated {
  readonly type: 'FreeSlideCreated'
  readonly slide: FreeSlide
  readonly index: number
}

/** Complete slide + position, like `CategoryDeleted`. */
export interface FreeSlideDeleted {
  readonly type: 'FreeSlideDeleted'
  readonly slide: FreeSlide
  readonly index: number
}

/** Title, anchor and blocks move together: the whole slide is replaced. */
export interface FreeSlideChanged {
  readonly type: 'FreeSlideChanged'
  readonly id: string
  readonly before: FreeSlide
  readonly after: FreeSlide
}

/** Same `splice` semantics as `CategoryMoved`. */
export interface FreeSlideMoved {
  readonly type: 'FreeSlideMoved'
  readonly id: string
  readonly from: number
  readonly to: number
}
