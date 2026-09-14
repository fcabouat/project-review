/**
 * Free-slide commands — the intent variants of the free-slide aggregate:
 * target, new value and, for a creation, where to insert (see the commands
 * barrel).
 */
import type { FreeSlide } from '../model/free-slide'

/** Insert a complete free slide at `index`. */
export interface CreateFreeSlide {
  readonly type: 'CreateFreeSlide'
  readonly slide: FreeSlide
  readonly index: number
}

export interface DeleteFreeSlide {
  readonly type: 'DeleteFreeSlide'
  readonly id: string
}

/** Replace the whole slide (title, anchor, blocks — and possibly its id). */
export interface ChangeFreeSlide {
  readonly type: 'ChangeFreeSlide'
  readonly id: string
  readonly after: FreeSlide
}

export interface MoveFreeSlide {
  readonly type: 'MoveFreeSlide'
  readonly id: string
  readonly to: number
}
