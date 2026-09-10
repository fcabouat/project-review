/**
 * Runtime palette service. The portfolio may carry its OWN twelve category
 * colors (`settings.theme.customPalette`); this module is what turns that
 * table into the very same `--cat-*` custom properties the built-in families
 * declare in the components' `palettes.css`. TOTAL: never throws, and a table
 * it cannot emit safely simply does not apply.
 *
 * WHY THE ROOT, AND INLINE. The built-in families live under
 * `[data-palette='<name>']` on `<html>`; the portfolio's palette must WIN over
 * whichever family is selected, for as long as it is there. Setting the twelve
 * properties inline on `<html>` says exactly that — an inline declaration
 * outranks every stylesheet rule, whatever the order sheets happen to load in
 * — and it keeps the mechanism where the other root-level runtime choice
 * already lives (`applyFont` sets `--font` the same way).
 *
 * Nothing downstream knows. Every consumer reads `var(--cat-<name>)`
 * (`commons/cat-color.ts`), so no theme, no template and no atom is aware
 * that the colors came from the file rather than from a family — which is the
 * whole point: the domain knows NAMES, never hexes.
 *
 * The price of an inline declaration is that no stylesheet collection can see
 * it, so the standalone export re-emits the rule itself — same arrangement as
 * `--font` (see `StandaloneParts.customPalette` in dom-export).
 */
import type { Color } from '@project-review/core/model/category'
import { COLORS } from '@project-review/core/model/category'
import type { CustomPalette } from '@project-review/core/model/theme'

/** Exact hex shape re-checked before EMISSION — the parse already enforced it
 * at the door (core `values/palette.ts`); this is the belt to that brace,
 * because the string lands verbatim inside a CSS declaration. */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** The custom property carrying one category color — the single naming rule,
 * shared with `palettes.css` and `commons/cat-color.ts`. */
const property = (name: Color): string => `--cat-${name}`

/**
 * The twelve declarations of a portfolio palette, as `[property, value]`
 * pairs — pure and TOTAL: a color whose value fails the emission re-check is
 * skipped, never thrown on. Empty for an absent palette.
 */
export function customPaletteEntries(
  palette: CustomPalette | undefined,
): readonly (readonly [property: string, value: string])[] {
  if (palette === undefined) return []
  const colors: Partial<Record<Color, string>> = palette.colors ?? {}
  return COLORS.flatMap((name) => {
    const value = colors[name]
    return value !== undefined && HEX_COLOR.test(value) ? [[property(name), value] as const] : []
  })
}

/**
 * The same twelve declarations as one `:root` CSS rule — what the standalone
 * export re-emits, since the live application applies them inline (see the
 * module header). Empty string for an absent or unusable palette, so the
 * exported deck falls back to the family its `data-palette` names.
 */
export function customPaletteCss(palette: CustomPalette | undefined): string {
  const entries = customPaletteEntries(palette)
  if (entries.length === 0) return ''
  return `:root{${entries.map(([name, value]) => `${name}:${value}`).join(';')}}`
}

/**
 * Applies the portfolio's palette to the live document: the twelve properties
 * set inline on `<html>`, and REMOVED when the portfolio carries no palette of
 * its own — so switching back to a built-in family takes effect at once, with
 * nothing left behind. Safe to call on every settings change and outside a
 * browser (`doc` undefined → no-op).
 */
export function applyCustomPalette(
  palette: CustomPalette | undefined,
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): void {
  if (!doc) return
  const style = doc.documentElement.style
  const entries = new Map(customPaletteEntries(palette))
  for (const name of COLORS) {
    const value = entries.get(property(name))
    if (value === undefined) style.removeProperty(property(name))
    else style.setProperty(property(name), value)
  }
}
