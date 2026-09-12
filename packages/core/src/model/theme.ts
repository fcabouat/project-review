/**
 * Presentation vocabulary — the closed choices that shape how the deck LOOKS
 * and SPEAKS, never what it says: deck language, color family, layout family.
 *
 * PURE module: types and their runtime mirrors only (the one import is the
 * sibling model type the palette table is keyed by).
 */
import type { Color } from './category'

/** Deck language — drives every GENERATED label (catalog, dates, typography);
 * entered content is never translated. */
export type Language = 'fr' | 'en'

/** Color family resolving the 12 generic category color names — the hex values
 * live in the components' `palettes.css` ([data-palette] blocks): switching
 * family re-themes the whole deck without touching the data. */
export type PaletteFamily = 'tailwind' | 'material' | 'uniform'

/** Layout family: 'flat' (the default), 'institutional' or 'modern'. */
export type ThemeStyle = 'flat' | 'institutional' | 'modern'

/**
 * A palette the PORTFOLIO carries (`settings.theme.customPalette`) instead of
 * choosing among the built-in families — an organization brings its own twelve
 * colors in the data file, the way it already brings its logo and its font
 * faces. It TAKES PRECEDENCE over the chosen {@link PaletteFamily} for as long
 * as it is there.
 *
 * The domain still knows nothing but NAMES: this is a table from the twelve
 * category color names to hex values, not style. Whoever applies it turns it
 * into the same `--cat-*` custom properties the built-in families declare, so
 * no theme and no component is aware of it.
 *
 * `colors` is exhaustive by construction and by contract: the twelve names of
 * {@link Color}, no more and no less — a partial palette would leave a
 * category silently on another family's hue. The values are the exact
 * hexadecimal shape `values/palette.ts` states.
 */
export interface CustomPalette {
  /** What to call it in the interface; absent → a generic label. */
  readonly label?: string
  /** The twelve category names, each mapped to a `#rrggbb` value. */
  readonly colors: Readonly<Record<Color, string>>
}

/** Slant of an embedded font face — the two CSS `font-style` values a deck uses. */
export type FontFaceStyle = 'normal' | 'italic'

/**
 * One font face EMBEDDED in the portfolio (`settings.theme.fontFaces`): a
 * woff2 file carried as a data URI, so the deck's font travels inside the
 * .json like the inline logo does — no deployment, no network. Named
 * `EmbeddedFontFace` because `FontFace` is already the DOM's own type.
 *
 * `weight` is a CSS `font-weight` descriptor: one integer in 400–800, or an
 * ascending "min max" pair ("500 600") for a face that covers a range. The
 * parse pins the shape; the whole face is string data — the core never
 * decodes the bytes.
 */
export interface EmbeddedFontFace {
  /** Family name — same charset contract as `settings.theme.font`. */
  readonly family: string
  readonly weight: string
  readonly style: FontFaceStyle
  /** `data:font/woff2;base64,…` — charset and size are checked at the parse. */
  readonly dataUri: string
}

/** Every {@link FontFaceStyle}, default first. */
export const FONT_FACE_STYLES: readonly FontFaceStyle[] = ['normal', 'italic']

/** Every {@link Language}, default first. */
export const LANGUAGES: readonly Language[] = ['fr', 'en']

/** Every {@link PaletteFamily}, in display order: the default family first —
 * the Settings screen renders its radios straight from this list. */
export const PALETTES: readonly PaletteFamily[] = ['material', 'tailwind', 'uniform']

/** Every {@link ThemeStyle}, default first. */
export const THEME_STYLES: readonly ThemeStyle[] = ['flat', 'institutional', 'modern']
