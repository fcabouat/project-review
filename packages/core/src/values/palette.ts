/**
 * Palette values — the one rule a category color must obey when the PORTFOLIO
 * carries the palette itself (`settings.theme.customPalette`): an exact
 * six-digit hexadecimal, `#` included.
 *
 * It lives HERE, at the bottom layer, because two sides must judge it
 * identically: the strict parse at the door (services/parse/settings.ts) and
 * the commands the editor emits (commands/contract.ts). The running model may
 * never hold a color the file format would refuse to read back.
 *
 * The charset is a SECURITY line, not taste — same reasoning as the font
 * family name (values/font.ts): every one of the twelve values is re-emitted
 * verbatim into a `<style>` element of the exported deck (a raw-text context,
 * inside a custom-property declaration), so anything outside `#` plus six
 * hex digits is refused at the door rather than escaped later. Three-digit
 * shorthands, eight-digit alpha forms, `rgb()`, named colors and CSS-wide
 * keywords are all outside the format on purpose: one shape, judged once.
 *
 * PURE module: no import at all.
 */

/** Exact shape of a palette color: `#` and six hexadecimal digits. */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** `true` for a value honoring {@link HEX_COLOR}. */
export const isHexColor = (value: string): boolean => HEX_COLOR.test(value)
