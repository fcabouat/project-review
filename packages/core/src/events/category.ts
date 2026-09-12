/**
 * Category events — creation and deletion carry the COMPLETE category plus its
 * position (design rule 1, index.ts), the scalar edits carry before → after,
 * the move carries both indexes; routing stays on the stable `id`.
 */
import type { Category, Color } from '../model/category'

/** `index` = insertion position, carried so that the inverse restores it. */
export interface CategoryCreated {
  readonly type: 'CategoryCreated'
  readonly category: Category
  readonly index: number
}

/**
 * Carries the COMPLETE deleted category and its position (design rule 1): the
 * inverse recreates it identically without consulting anything.
 */
export interface CategoryDeleted {
  readonly type: 'CategoryDeleted'
  readonly category: Category
  readonly index: number
}

/** `before`/`after` are the display names; routing stays on the stable `id`. */
export interface CategoryRenamed {
  readonly type: 'CategoryRenamed'
  readonly id: string
  readonly before: string
  readonly after: string
}

/** Values are palette-independent {@link Color} names, never hex codes. */
export interface CategoryRecolored {
  readonly type: 'CategoryRecolored'
  readonly id: string
  readonly before: Color
  readonly after: Color
}

/** Removal then re-insertion (`splice` semantics): the inverse swaps from/to. */
export interface CategoryMoved {
  readonly type: 'CategoryMoved'
  readonly id: string
  readonly from: number
  readonly to: number
}
