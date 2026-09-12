/**
 * The inline logo — an image carried INSIDE the portfolio as a `data:image/…`
 * URI, so the organization's mark travels with the file (no deployment, no
 * network). Two rules, one shape and one size, stated here at the bottom layer
 * so the strict parse (services/parse/settings.ts) and the commands the editor
 * emits (commands/contract.ts) judge a logo identically — the running model may
 * never hold a logo the file format would refuse to read back.
 *
 * PURE module: values only.
 */
import { maxDeclaredBytes } from './data-uri'

/** Inline-logo guard (~300 KB of binary once base64-encoded): keeps the JSON portable. */
export const LOGO_MAX_CHARS = 400_000

/** {@link LOGO_MAX_CHARS} said in DECLARED BYTES — what a picked image may
 * weigh and still have a chance of fitting, so the Settings card refuses an
 * oversize file before reading it rather than after (values/data-uri.ts). */
export const LOGO_MAX_BYTES = maxDeclaredBytes(LOGO_MAX_CHARS)

/** `true` for a `data:image/…` URI — the MIME is the image's own, the format
 * is never decoded here (values stay binary-free). */
export const isImageDataUri = (uri: string): boolean => /^data:image\//.test(uri)

/** `true` for a logo that is both a `data:image/…` URI and within the size
 * guard — the two rules the file format states, together. */
export const isLogo = (uri: string): boolean => isImageDataUri(uri) && uri.length <= LOGO_MAX_CHARS
