/**
 * File-name → embedded-face mapping for the font picker (Settings ▸
 * Appearance): the variant of a picked .woff2 is read from its NAME — the
 * web's own naming idiom (`Atelier-Bold.woff2`, `Inter_Italic.woff2`), and
 * exactly the files the deployment convention already names. No byte is
 * ever inspected here: the infrastructure's reader validates the payload, this
 * module only proposes `family`, `weight` and `style` for the user's pick.
 *
 * Static variants retain their CSS weight (100–900). Unlike the legacy
 * three-file deployment convention, imported Medium/Bold faces do not claim
 * ranges that would overlap an imported Semibold/ExtraBold face.
 *
 * PURE module: strings in, proposal out — same discipline as `fuzzy.ts`.
 */
import type { EmbeddedFontFace, FontFaceStyle } from '@project-review/core/model/theme'

/** Same charset line as the core's `FONT_NAME` — what a family may look like. */
const SAFE_FAMILY = /^[A-Za-z0-9 _-]{1,64}$/

/** Recognised weight suffixes, longest first so `ExtraBold` wins over `Bold`. */
const WEIGHT_SUFFIXES: readonly (readonly [string, string])[] = [
  ['extrabold', '800'],
  ['ultrabold', '800'],
  ['semibold', '600'],
  ['demibold', '600'],
  ['extralight', '200'],
  ['ultralight', '200'],
  ['black', '900'],
  ['heavy', '900'],
  ['medium', '500'],
  ['regular', '400'],
  ['normal', '400'],
  ['light', '300'],
  ['bold', '700'],
  ['book', '400'],
  ['thin', '100'],
]

/** The proposed variant of one picked file — everything but the bytes. */
export type FaceProposal = Omit<EmbeddedFontFace, 'dataUri'>

/**
 * Proposes the face a file name describes, or `undefined` when the name is
 * not a usable .woff2 (wrong extension, or nothing family-shaped left once
 * the variant suffixes are stripped). Directory pickers hand over full
 * relative paths — only the base name speaks.
 */
export function faceFromFileName(fileName: string): FaceProposal | undefined {
  const base = fileName.split('/').at(-1) ?? fileName
  if (!/\.woff2$/i.test(base)) return undefined
  let stem = base.replace(/\.woff2$/i, '')

  let style: FontFaceStyle = 'normal'
  const italic = /^(.*?)[-_ ]?(italic|oblique)$/i.exec(stem)
  if (italic !== null) {
    style = 'italic'
    stem = italic[1]!
  }

  let weight = '400'
  for (const [suffix, value] of WEIGHT_SUFFIXES) {
    const m = new RegExp(`^(.*?)[-_ ]?${suffix}$`, 'i').exec(stem)
    if (m !== null) {
      weight = value
      stem = m[1]!
      break
    }
  }

  // Numeric suffixes are common in variable/static font exports (e.g.
  // `Family-300.woff2`) and already fit the core's 100–900 contract.
  if (weight === '400') {
    const numeric = /^(.*?)[-_ ]?(100|200|300|400|500|600|700|800|900)$/.exec(stem)
    if (numeric !== null) {
      weight = numeric[2]!
      stem = numeric[1]!
    }
  }

  const family = stem.replace(/[-_]+/g, ' ').trim()
  if (family === '' || !SAFE_FAMILY.test(family)) return undefined
  return { family, weight, style }
}

/** Approximate binary size of a face, in KB — 3/4 of the base64 payload. */
export function faceSizeKb(dataUri: string): number {
  const payload = Math.max(dataUri.length - 'data:font/woff2;base64,'.length, 0)
  return Math.max(1, Math.round((payload * 3) / 4 / 1024))
}
