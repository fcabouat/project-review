/**
 * Runtime font service (plan § 8). The portfolio carries a font family name
 * (`settings.theme.font`); this module turns it into a CSS stack on `--font`
 * and, for any family that is not bundled, loads it from Google Fonts on
 * demand. TOTAL: never throws, always leaves a valid stack.
 *
 * Bundled families — never fetched:
 * - Roboto (the default) and Inter ship as @fontsource woff2, imported by
 *   `main.ts`;
 * - Marianne's @font-face rules live in app.css and light up only if the woff2
 *   files are deployed under /fonts/marianne/ (the State font is not
 *   redistributed in this public repository).
 */

/** Both leading families ship in the bundle — Roboto, the default, first. */
const FALLBACK_STACK = "'Roboto', 'Inter', 'Segoe UI', system-ui, sans-serif"

/** Families that must NEVER produce a Google Fonts request. */
const BUNDLED_FAMILIES: readonly string[] = ['Roboto', 'Inter', 'Marianne']

/** Weights actually used by the slides and the editor. */
const WEIGHTS = '400;500;600;700;800'

/**
 * CSS `font-family` value for `--font`. The requested family is quoted first,
 * always backed by the full fallback stack, so a typo or an unloaded Google
 * family silently degrades to Roboto instead of a browser default. Stray
 * quotes in the input are stripped — the portfolio stores a bare name, but a
 * hand-edited JSON may quote it, and doubled quotes would void the whole
 * declaration.
 */
export function fontStack(family: string): string {
  const clean = family.trim().replace(/['"]/g, '')
  if (clean === '' || clean === 'Roboto') return FALLBACK_STACK
  // Explicit Inter must come FIRST in its own stack, not behind Roboto.
  if (clean === 'Inter') return "'Inter', 'Roboto', 'Segoe UI', system-ui, sans-serif"
  return `'${clean}', ${FALLBACK_STACK}`
}

/** Google Fonts CSS URL — null for the bundled families (see header). */
export function googleFontsUrl(family: string): string | null {
  const clean = family.trim().replace(/['"]/g, '')
  if (clean === '' || BUNDLED_FAMILIES.includes(clean)) return null
  const encoded = encodeURIComponent(clean).replace(/%20/g, '+')
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@${WEIGHTS}&display=swap`
}

/** Stable element id so the same family is never loaded twice. */
export function fontLinkId(family: string): string {
  return `rp-font-${family
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`
}

/**
 * Applies the portfolio's font to the live document: sets the inline `--font`
 * on `<html>` (which is why the export must re-emit that rule — see
 * `StandaloneParts.fontFamily`), then, for a non-bundled family, injects ONE
 * Google Fonts `<link>` (deduplicated by {@link fontLinkId}, skipped offline).
 * Safe to call on every settings change and outside a browser (`doc`
 * undefined → no-op). The stack lands synchronously; the fetched face only
 * upgrades rendering when it arrives.
 */
export function applyFont(
  family: string,
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): void {
  if (!doc) return
  doc.documentElement.style.setProperty('--font', fontStack(family))
  const url = googleFontsUrl(family)
  if (url === null) return
  // Offline (or file:// without network): don't even try — the fallback stack
  // is already in place and an attempted fetch would only litter the console.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const id = fontLinkId(family)
  if (doc.getElementById(id) !== null) return
  const link = doc.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = url
  // A family that fails to load must not leave a poisoned dedup entry behind.
  link.onerror = () => link.remove()
  doc.head.appendChild(link)
}
