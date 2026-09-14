/**
 * Runtime font service. The portfolio carries a font family name
 * (`settings.theme.font`); this module turns it into a CSS stack on `--font`.
 * TOTAL: never throws, always leaves a valid stack.
 *
 * NO NETWORK, EVER. The product's promise is that nothing leaves the browser,
 * and a font is not an exception to it: fetching a family from a third party
 * would announce the reader's IP to that third party on every open — the one
 * request a local-first tool must not make. So there are exactly three
 * sources, all local, and a family outside them renders on the system stack:
 * - EMBEDDED faces (`settings.theme.fontFaces`) travel inside the portfolio
 *   as woff2 data URIs; {@link applyEmbeddedFonts} injects their `@font-face`
 *   rules into one owned `<style>`. The injected sheet is an ordinary document
 *   stylesheet, so the standalone export collects the rules with everything
 *   else (its CSP already allows `font-src data:`);
 * - BUNDLED families ({@link BUNDLED_FAMILIES}) — Roboto (the default) and
 *   Inter ship as @fontsource woff2, imported by `main.ts`;
 * - a DEPLOYED family — ANY family, by convention: drop its woff2 under
 *   `fonts/<family>/` next to the app and {@link applyDeployedFont} declares
 *   the faces for it. Same-origin, under the app's own path: a deployment
 *   serving its own files is not a third party learning who reads what.
 * Anything else falls back to the stack — visibly: the Settings card says so
 * ({@link probeFont} and the host's font-status wiring), so the reader is
 * never left wondering why a family did not apply.
 *
 * No family is named in this module. The mechanism is generic on purpose: the
 * product carries no house font, and whichever one an organization uses is its
 * own affair — embedded in the portfolio, or deployed beside the app.
 */
import type { EmbeddedFontFace } from '@project-review/core/model/theme'
import { isFontWeight } from '@project-review/core/values/font'

/** Both leading families ship in the bundle — Roboto, the default, first. */
const FALLBACK_STACK = "'Roboto', 'Inter', 'Segoe UI', system-ui, sans-serif"

/** The families this build actually carries: their woff2 files are inside the
 * bundle, so they need neither a deployment nor a request. */
export const BUNDLED_FAMILIES: readonly string[] = ['Roboto', 'Inter']

/**
 * CSS `font-family` value for `--font`. The requested family is quoted first,
 * always backed by the full fallback stack, so a family this build does not
 * carry degrades to Roboto instead of a browser default. Stray quotes in the
 * input are stripped — the portfolio stores a bare name, but a hand-edited
 * JSON may quote it, and doubled quotes would void the whole declaration.
 */
export function fontStack(family: string): string {
  const clean = family.trim().replace(/['"]/g, '')
  if (clean === '' || clean === 'Roboto') return FALLBACK_STACK
  // Explicit Inter must come FIRST in its own stack, not behind Roboto.
  if (clean === 'Inter') return "'Inter', 'Roboto', 'Segoe UI', system-ui, sans-serif"
  return `'${clean}', ${FALLBACK_STACK}`
}

/** Verdict of {@link probeFont}: `unknown` while probing (or when the
 * browser exposes no Font Loading API), then `served` or `missing`. */
export type FontProbeStatus = 'unknown' | 'served' | 'missing'

/**
 * Live probe of a locally SERVED face — the Settings card asks it about the
 * family the portfolio names, whichever it is, once the deployed faces have
 * been declared. `document.fonts.check()` alone would lie before
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
    return faces.length > 0 ? 'served' : 'missing'
  } catch {
    return 'missing'
  }
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
        isFontWeight(f.weight) &&
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
 * file encode to eight characters. Decode those four bytes rather than
 * comparing a truncated base64 prefix: the sixth base64 character can vary
 * with the fifth byte (`d09GMg` is only one spelling).
 */
const WOFF2_MAGIC = [0x77, 0x4f, 0x46, 0x32] as const // `wOF2`

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Decode only the first four bytes, keeping validation bounded by 8 chars. */
function hasWoff2Magic(payload: string): boolean {
  if (payload.length < 8) return false
  const chars = payload.slice(0, 8)
  const values = [...chars].map((char) => BASE64_ALPHABET.indexOf(char))
  if (values.some((value) => value < 0)) return false
  const bytes = [
    (values[0]! << 2) | (values[1]! >> 4),
    ((values[1]! & 15) << 4) | (values[2]! >> 2),
    ((values[2]! & 3) << 6) | values[3]!,
    (values[4]! << 2) | (values[5]! >> 4),
  ]
  return bytes.every((byte, index) => byte === WOFF2_MAGIC[index])
}

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
  if (!hasWoff2Magic(payload)) return null
  const normalised = `data:font/woff2;base64,${payload}`
  return WOFF2_DATA_URI.test(normalised) ? normalised : null
}

/* v8 ignore start -- FileReader half: exercised by the embed scenario of the
   Playwright smoke test (`pnpm run smoke`), which picks a real .woff2 through
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

/* -------------------------- deployed family ---------------------------- */

/** The one `<style>` element that owns the DEPLOYED family's rules. */
export const DEPLOYED_STYLE_ID = 'rp-deployed-font'

/**
 * The deployment convention, and the whole of it: a family is served by
 * dropping its woff2 into a folder named after it, beside the app —
 * `fonts/<family>/<family>-Regular.woff2` and its two siblings. The three
 * variants cover the weights the slides and the editor use, and they are the
 * SAME mapping the editor's file picker proposes (`font-files.ts`), so a
 * portfolio embedding those three files behaves exactly like a deployment
 * serving them.
 */
export const DEPLOYED_VARIANTS: readonly (readonly [variant: string, weight: string])[] = [
  ['Regular', '400'],
  ['Medium', '500 600'],
  ['Bold', '700 800'],
]

/**
 * The `@font-face` rules that let a DEPLOYED family light up, as one CSS
 * string — pure and TOTAL. Empty for a family this build already carries
 * (bundled faces need no deployment) or for a name outside the charset.
 *
 * The URLs are RELATIVE: the app resolves them against its own document, so
 * the same build works at a domain root, under a sub-path, or from a folder —
 * and never points anywhere but at its own deployment.
 */
export function deployedFontFaceCss(family: string): string {
  const clean = family.trim().replace(/['"]/g, '')
  if (!SAFE_FAMILY.test(clean) || BUNDLED_FAMILIES.includes(clean)) return ''
  const dir = encodeURIComponent(clean)
  return DEPLOYED_VARIANTS.map(
    ([variant, weight]) =>
      `@font-face{font-family:'${clean}';font-weight:${weight};` +
      `font-style:normal;font-display:swap;` +
      `src:url("fonts/${dir}/${dir}-${variant}.woff2") format('woff2')}`,
  ).join('\n')
}

/**
 * Declares the deployed faces of the current family into the live document:
 * ONE owned `<style>`, replaced wholesale on change, removed when there is
 * nothing to declare. Safe to call on every settings change and outside a
 * browser (`doc` undefined → no-op).
 *
 * `embedded` lists the families the portfolio carries itself
 * ({@link embeddedFamilies}): a covered family declares NOTHING here — its
 * data URIs are already the strongest source, and pointing at a deployment
 * that may not have the files would only add failed requests.
 */
export function applyDeployedFont(
  family: string,
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
  embedded: readonly string[] = [],
): void {
  if (!doc) return
  const clean = family.trim().replace(/['"]/g, '')
  const css = embedded.includes(clean) ? '' : deployedFontFaceCss(clean)
  const existing = doc.getElementById(DEPLOYED_STYLE_ID)
  if (css === '') {
    existing?.remove()
    return
  }
  if (existing !== null) {
    if (existing.textContent !== css) existing.textContent = css
    return
  }
  const style = doc.createElement('style')
  style.id = DEPLOYED_STYLE_ID
  style.textContent = css
  doc.head.appendChild(style)
}

/**
 * Applies the portfolio's font to the live document: sets the inline `--font`
 * on `<html>` (which is why the export must re-emit that rule — see
 * `StandaloneParts.fontFamily`). That is the WHOLE of it — no request, no
 * injected `<link>`, nothing to wait for: the stack lands synchronously, and a
 * family neither bundled, embedded nor deployed simply renders on the
 * fallback. Safe to call on every settings change and outside a browser
 * (`doc` undefined → no-op).
 */
export function applyFont(
  family: string,
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): void {
  if (!doc) return
  doc.documentElement.style.setProperty('--font', fontStack(family))
}
