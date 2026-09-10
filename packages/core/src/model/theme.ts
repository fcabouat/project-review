/**
 * Presentation vocabulary — the closed choices that shape how the deck LOOKS
 * and SPEAKS, never what it says: deck language, color family, layout family.
 *
 * PURE module: types and their runtime mirrors only.
 */

/** Deck language — drives every GENERATED label (catalog, dates, typography);
 * entered content is never translated. */
export type Language = 'fr' | 'en'

/** Color family resolving the 12 generic category color names — the hex values
 * live in the components' `palettes.css` ([data-palette] blocks): switching
 * family re-themes the whole deck without touching the data. */
export type PaletteFamily = 'gov' | 'tailwind' | 'material'

/** Layout family: 'flat' (the default, Material spirit) or 'institutional'. */
export type ThemeStyle = 'flat' | 'institutional'

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
export const PALETTES: readonly PaletteFamily[] = ['material', 'tailwind', 'gov']

/** Every {@link ThemeStyle}, default first. */
export const THEME_STYLES: readonly ThemeStyle[] = ['flat', 'institutional']
