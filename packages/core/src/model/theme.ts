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

/** Layout family: 'flat' (V2 default, Material spirit) or 'classic' (V1). */
export type ThemeStyle = 'flat' | 'classic'

/** Every {@link Language}, default first. */
export const LANGUAGES: readonly Language[] = ['fr', 'en']

/** Every {@link PaletteFamily}, in settings order. */
export const PALETTES: readonly PaletteFamily[] = ['dsfr', 'tailwind', 'material']

/** Every {@link ThemeStyle}, default first. */
export const THEME_STYLES: readonly ThemeStyle[] = ['flat', 'classic']
