/**
 * Runtime font service. The portfolio carries a font family name
 * (`settings.theme.font`); this module turns it into a CSS stack on `--font`
 * and, for any family that is not bundled, loads it from Google Fonts on
 * demand. TOTAL: never throws, always leaves a valid stack.
 *
 * Family precedence — embedded > bundled > Google:
 * - EMBEDDED faces (`settings.theme.fontFaces`) travel inside the portfolio
 *   as woff2 data URIs; {@link applyEmbeddedFonts} injects their `@font-face`
 *   rules into one owned `<style>`, and {@link applyFont} never emits a
 *   Google `<link>` for a family the portfolio embeds. The injected sheet is
 *   an ordinary document stylesheet, so the standalone export collects the
 *   rules with everything else (its CSP already allows `font-src data:`).
 * - Bundled families — never fetched: Roboto (the default) and Inter ship as
 *   @fontsource woff2, imported by `main.ts`; Marianne's @font-face rules
 *   live in app.css and light up only if the woff2 files are deployed under
 *   /fonts/marianne/ (the State font is not redistributed in this public
 *   repository).
 * - Anything else: one Google Fonts `<link>`, on demand.
 */
import type { EmbeddedFontFace } from '@project-review/core/model/theme'

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

/** Verdict of {@link probeFont}: `unknown` while probing (or when the
 * browser exposes no Font Loading API), then `served` or `missing`. */
export type FontProbeStatus = 'unknown' | 'served' | 'missing'

/**
 * Live probe of a locally SERVED face — the Settings card asks it about
 * Marianne, the one family whose files are deployed alongside the app rather
 * than bundled or fetched. `document.fonts.check()` alone would lie before
 * any load attempt (an unloaded but declared face reports unavailable, and
 * nothing has reason to load a face nobody displays yet), so the probe first
 * FORCES a targeted load, then asks. TOTAL: any refusal — rejected load,
 * missing files, no Font Loading API result — degrades to a calm verdict,
 * never a throw. `unknown` only when the API itself is absent: with no way
 * to ask, claiming `missing` would slander a working deployment.
 */
export async function probeFont(
  family: string,
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): Promise<FontProbeStatus> {
  const clean = family.trim().replace(/['"]/g, '')
  if (clean === '') return 'missing'
  const fonts = doc?.fonts
  if (!fonts || typeof fonts.load !== 'function' || typeof fonts.check !== 'function') {
    return 'unknown'
  }
  const probe = `16px "${clean}"`
  try {
    const faces = await fonts.load(probe)
    return faces.length > 0 || fonts.check(probe) ? 'served' : 'missing'
  } catch {
    return 'missing'
  }
}

/** Stable element id so the same family is never loaded twice. */
export function fontLinkId(family: string): string {
  return `rp-font-${family
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`
}

/* --------------------------- embedded faces ---------------------------- */

/** The one `<style>` element that owns every embedded `@font-face` rule. */
export const EMBEDDED_STYLE_ID = 'rp-embedded-fonts'

/** Exact data-URI shape re-checked before EMISSION — the parse already
 * enforced it at the door; this is the belt to that brace, because the string
 * lands verbatim inside `url()` CSS. */
const WOFF2_DATA_URI = /^data:font\/woff2;base64,[A-Za-z0-9+/]+={0,2}$/

/** Same charset line as the core's `FONT_NAME` — the family name is emitted
 * into a quoted CSS string. */
const SAFE_FAMILY = /^[A-Za-z0-9 _-]{1,64}$/

/** `weight` descriptor as the parse shaped it — integer or "min max" pair. */
const SAFE_WEIGHT = /^\d{3}(?: \d{3})?$/

/**
 * The `@font-face` rules of the embedded faces, as one CSS string — pure and
 * TOTAL: a face whose strings fail the emission re-check is skipped, never
 * thrown on. `font-display: swap` keeps first paint on the fallback stack.
 * Also what gives embedded faces precedence over the BUNDLED families: the
 * owned `<style>` is appended to `<head>` after every bundled sheet, and for
 * equal descriptors CSS hands the win to the last declaration.
 */
export function embeddedFontFaceCss(faces: readonly EmbeddedFontFace[] | undefined): string {
  if (faces === undefined) return ''
  return faces
    .filter(
      (f) =>
        SAFE_FAMILY.test(f.family) &&
        SAFE_WEIGHT.test(f.weight) &&
        (f.style === 'normal' || f.style === 'italic') &&
        WOFF2_DATA_URI.test(f.dataUri),
    )
    .map(
      (f) =>
        `@font-face{font-family:'${f.family}';font-weight:${f.weight};` +
        `font-style:${f.style};font-display:swap;` +
        `src:url("${f.dataUri}") format('woff2')}`,
    )
    .join('\n')
}

/** The families the given faces actually cover (emission-valid ones only). */
export function embeddedFamilies(
  faces: readonly EmbeddedFontFace[] | undefined,
): readonly string[] {
  return [...new Set((faces ?? []).filter((f) => SAFE_FAMILY.test(f.family)).map((f) => f.family))]
}

/**
 * Base64 of the woff2 magic (`wOF2`): the first four bytes of every woff2
 * file encode to six stable characters — a cheap signature check that stays
 * string-only. (woff1 gives `d09GRg`, a TTF `AAEAAA`: both refused.)
 */
const WOFF2_MAGIC_B64 = 'd09GMg'

/**
 * Normalises a `FileReader.readAsDataURL` result into the portfolio's exact
 * woff2 data-URI shape, or `null` for anything that is not a woff2. Pure half
 * of {@link readWoff2File}: the browser stamps whatever MIME the OS guessed
 * (often `application/octet-stream`), so the prefix is REWRITTEN to the
 * canonical `data:font/woff2;base64,` and the payload must open on the woff2
 * magic — a renamed PNG is refused here, before any dispatch.
 */
export function asWoff2DataUri(rawDataUri: string): string | null {
  const comma = rawDataUri.indexOf(',')
  if (comma < 0 || !rawDataUri.slice(0, comma).includes(';base64')) return null
  const payload = rawDataUri.slice(comma + 1)
  if (!payload.startsWith(WOFF2_MAGIC_B64)) return null
  const normalised = `data:font/woff2;base64,${payload}`
  return WOFF2_DATA_URI.test(normalised) ? normalised : null
}

/* v8 ignore start -- FileReader half: exercised by the embed scenario of the
   Playwright smoke test (`bun run smoke`), which picks a real .woff2 through
   the Settings card — same out-of-node perimeter as dom-export's DOM half. */
/**
 * Reads one picked file into the portfolio's woff2 data-URI shape. TOTAL:
 * an unreadable file or a non-woff2 payload resolves `null`, never throws —
 * the Settings card turns `null` into its calm refusal line. This is the
 * effect the pure screens receive as a prop (`readFontFile`): FileReader is
 * a browser affair, so it lives here, not in components.
 */
export function readWoff2File(file: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => resolve(null)
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? asWoff2DataUri(reader.result) : null)
    reader.readAsDataURL(file)
  })
}
/* v8 ignore stop */

/**
 * Installs the embedded faces into the live document: ONE owned `<style>`
 * (created on first need, replaced wholesale on change, removed when nothing
 * is embedded — the bundled families take back over). Safe to call on every
 * settings change and outside a browser (`doc` undefined → no-op).
 */
export function applyEmbeddedFonts(
  faces: readonly EmbeddedFontFace[] | undefined,
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): void {
  if (!doc) return
  const css = embeddedFontFaceCss(faces)
  const existing = doc.getElementById(EMBEDDED_STYLE_ID)
  if (css === '') {
    existing?.remove()
    return
  }
  if (existing !== null) {
    if (existing.textContent !== css) existing.textContent = css
    return
  }
  const style = doc.createElement('style')
  style.id = EMBEDDED_STYLE_ID
  style.textContent = css
  doc.head.appendChild(style)
}

/**
 * Applies the portfolio's font to the live document: sets the inline `--font`
 * on `<html>` (which is why the export must re-emit that rule — see
 * `StandaloneParts.fontFamily`), then, for a non-bundled family, injects ONE
 * Google Fonts `<link>` (deduplicated by {@link fontLinkId}, skipped offline).
 * Safe to call on every settings change and outside a browser (`doc`
 * undefined → no-op). The stack lands synchronously; the fetched face only
 * upgrades rendering when it arrives.
 *
 * `embedded` lists the families the portfolio embeds ({@link embeddedFamilies}):
 * a covered family never produces a Google request — embedded wins over the
 * network — and any `<link>` a previous choice injected for it is removed, so
 * the data-URI faces are the only source left.
 */
export function applyFont(
  family: string,
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
  embedded: readonly string[] = [],
): void {
  if (!doc) return
  doc.documentElement.style.setProperty('--font', fontStack(family))
  if (embedded.includes(family.trim().replace(/['"]/g, ''))) {
    doc.getElementById(fontLinkId(family))?.remove()
    return
  }
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
