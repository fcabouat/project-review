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
export type PaletteFamily = 'dsfr' | 'tailwind' | 'material'

/** Layout family: 'flat' (the default, Material spirit) or 'classic'. */
export type ThemeStyle = 'flat' | 'classic'

/** Every {@link Language}, default first. */
export const LANGUAGES: readonly Language[] = ['fr', 'en']

/** Every {@link PaletteFamily}, in display order: the default family first —
 * the Settings screen renders its radios straight from this list. */
export const PALETTES: readonly PaletteFamily[] = ['material', 'tailwind', 'dsfr']

/** Every {@link ThemeStyle}, default first. */
export const THEME_STYLES: readonly ThemeStyle[] = ['flat', 'classic']
