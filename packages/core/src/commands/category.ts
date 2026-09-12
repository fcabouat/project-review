/**
 * Category commands — the intent variants of the category aggregate: target,
 * new value and, for a creation, where to insert (see the commands barrel).
 */
import type { Category, Color } from '../model/category'

/** Insert a complete category at `index` (clamped by `apply`). */
export interface CreateCategory {
  readonly type: 'CreateCategory'
  readonly category: Category
  readonly index: number
}

/** Delete by id — the event recovers the full category and its position. */
export interface DeleteCategory {
  readonly type: 'DeleteCategory'
  readonly id: string
}

export interface RenameCategory {
  readonly type: 'RenameCategory'
  readonly id: string
  readonly after: string
}

export interface RecolorCategory {
  readonly type: 'RecolorCategory'
  readonly id: string
  readonly after: Color
}

/** Move to `to` (index within the list once the element is removed). */
export interface MoveCategory {
  readonly type: 'MoveCategory'
  readonly id: string
  readonly to: number
}
