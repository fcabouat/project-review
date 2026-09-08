/**
 * Categories — the portfolio's sections: a name,
 * a generic color, and the id projects reference.
 *
 * PURE module: no clock, no import beyond values/.
 */
import type { CategoryId } from '../values/ids'

/**
 * Category color, one of 12 generic names — palette-independent by
 * design: the data says "teal", the theme decides which teal (the hex values
 * live in the components' `palettes.css`). Note the sentinel 'grey' is NOT
 * here: no real category may claim it (see {@link UnsortedCategory}).
 */
export type Color =
  | 'blue'
  | 'indigo'
  | 'teal'
  | 'cyan'
  | 'green'
  | 'olive'
  | 'amber'
  | 'orange'
  | 'red'
  | 'purple'
  | 'brown'
  | 'taupe'

/**
 * A portfolio section. `id` is what projects reference (`categoryId`) and what
 * events route on; an id that no longer resolves does NOT orphan its projects —
 * they fall under the implicit {@link UNSORTED_CATEGORY}.
 */
export interface Category {
  readonly id: CategoryId
  readonly name: string
  readonly color: Color
}

/**
 * The implicit "unsorted" category is a SENTINEL, not a `Category` of the data:
 * its color is the neutral grey no real category may claim, and `name` holds an
 * i18n catalog key — resolve it via `unsortedCategoryName(language)`
 * (catalog/), never display it raw.
 */
export interface UnsortedCategory {
  readonly id: string
  readonly name: string
  readonly color: Color | 'grey'
}

/** Every {@link Color}, in swatch-grid order. */
export const COLORS: readonly Color[] = [
  'blue',
  'indigo',
  'teal',
  'cyan',
  'green',
  'olive',
  'amber',
  'orange',
  'red',
  'purple',
  'brown',
  'taupe',
]

/** Implicit fallback category for an orphan `categoryId`. */
export const UNSORTED_CATEGORY: UnsortedCategory = {
  id: 'unsorted',
  name: 'category.unsorted',
  color: 'grey',
}
