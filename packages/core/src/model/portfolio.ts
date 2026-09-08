/**
 * The portfolio — the whole document: the single
 * source of truth the deck and every figure are derived from, and exactly what
 * the .json export contains. Its two halves either side of the
 * content/settings boundary meet here: the edition block ({@link Review}) and
 * the presentation block ({@link Settings}).
 *
 * PURE module: no clock — the only reference date for derivations is
 * `review.reviewDate`.
 */
import type { IsoDate } from '../values/date'
import type { Category } from './category'
import type { FreeSlide } from './free-slide'
import type { Project } from './project'
import type { Language, PaletteFamily, ThemeStyle } from './theme'

/**
 * Who publishes the review — the organization block. Lives on the SETTINGS side
 * of the content/settings boundary: it travels with the theme in the
 * "organization kit" and survives a content-only import.
 */
export interface Identity {
  readonly org: string
  readonly unit: string
  readonly orgLong?: string
  readonly unitLong?: string
  readonly contact?: string
  /** Inline logo (`data:image/…` URI); absent → bundled Déjà Vu logo. */
  readonly logo?: string
}

/** The edition-specific block: what changes at every review. */
export interface Review {
  readonly title: string
  readonly subtitle?: string
  readonly reviewDate: IsoDate
  readonly previousReviewDate?: IsoDate
}

/**
 * Everything on the SETTINGS side of the content/settings boundary:
 * how the deck looks and which aggregate slides it shows, never what it says.
 * This is the block a content-only import can preserve ("keep my settings").
 */
export interface Settings {
  readonly language: Language
  readonly identity: Identity
  /** Runtime presentation choices: layout family, color family and font family ("Marianne" bundled, or any Google Fonts name; system fallback stack in every case). */
  readonly theme: {
    readonly style: ThemeStyle
    readonly palette: PaletteFamily
    readonly font: string
  }
  /** Aggregate slides toggles — a `false` removes the slide from the deck, the
   * underlying data stays. `decisions` also gates the previous-decisions
   * appendix. */
  readonly show: {
    readonly healthDashboard: boolean
    readonly recap: boolean
    readonly archives: boolean
    readonly decisions: boolean
  }
  /** Projects per recap page; the parse guarantees an integer in 6–16. */
  readonly recapRows: number
}

/**
 * The whole document. Array order is MEANINGFUL everywhere (categories = deck
 * order, projects = order within their category): reordering is a real edit,
 * carried by the move events.
 */
export interface Portfolio {
  readonly version: 3
  readonly review: Review
  readonly settings: Settings
  readonly categories: readonly Category[]
  readonly projects: readonly Project[]
  readonly freeSlides: readonly FreeSlide[]
}
