/**
 * Font values — the three refined strings a theme font is made of, plus the
 * size guards that keep an embedded family portable: the FAMILY NAME
 * ({@link isFontFamily}), the CSS `font-weight` descriptor of one embedded
 * face ({@link isFontWeight}) and the woff2 `data:` URI carrying the face
 * itself ({@link isWoff2DataUri}).
 *
 * They live HERE, at the bottom layer, because two sides must judge them
 * identically: the strict parse at the door (services/parse/settings.ts) and
 * the commands the editor emits (commands/contract.ts). A rule stated twice
 * drifts; a rule stated once cannot — and the whole point is that the running
 * model may never hold a font value the file format would refuse to read back.
 *
 * The charsets are SECURITY lines, not taste: family name and data URI are
 * re-emitted verbatim inside the exported deck's `<style>` (a raw-text
 * context), so `<`, `>`, quotes and anything outside base64 are refused at
 * the door.
 *
 * PURE module: no import at all.
 */

/**
 * Font families are letters, digits, spaces, `_` and `-` (64 chars max) — the
 * charset real family names use, and the only one safe to re-emit into CSS.
 */
export const FONT_NAME = /^[A-Za-z0-9 _-]{1,64}$/

/** `true` for a family name honoring {@link FONT_NAME} — the empty string is
 * refused (the pattern requires at least one character). */
export const isFontFamily = (family: string): boolean => FONT_NAME.test(family)

/** Shape of a `weight` descriptor: one three-digit integer, or a pair. */
const FONT_WEIGHT_SHAPE = /^(\d{3})(?: (\d{3}))?$/

/**
 * `true` for a CSS `font-weight` descriptor the deck can carry: one integer in
 * 400–800, or an ASCENDING "min max" pair of such integers (a variable face
 * covering a range).
 */
export const isFontWeight = (weight: string): boolean => {
  const m = FONT_WEIGHT_SHAPE.exec(weight)
  if (m === null) return false
  const min = Number(m[1])
  const max = m[2] === undefined ? min : Number(m[2])
  return min >= 400 && max <= 800 && min <= max
}

/**
 * Exact shape of an embedded face's `dataUri`: the woff2 MIME, then clean
 * base64 (charset + `=` padding only).
 */
const FONT_FACE_DATA_URI = /^data:font\/woff2;base64,[A-Za-z0-9+/]+={0,2}$/

/** `true` for a `data:font/woff2;base64,…` URI with a clean base64 payload. */
export const isWoff2DataUri = (dataUri: string): boolean => FONT_FACE_DATA_URI.test(dataUri)

/** Per-face guard on the `dataUri` LENGTH (~400 KB of binary once base64-encoded) —
 * measured on the string, never by decoding bytes (values stay binary-free).
 * One woff2 text face fits comfortably; a whole TTF does not. */
export const FONT_FACE_MAX_CHARS = 550_000

/** Guard on ALL embedded faces together (~1.5 MB of binary): a family in four
 * weights stays portable; the portfolio must remain a data file, not an archive. */
export const FONT_FACES_TOTAL_MAX_CHARS = 2_000_000
