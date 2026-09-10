/**
 * `settings` block — identity, theme, display toggles. The identity and the
 * four `show` toggles are required (they ARE the "organization kit"); the
 * theme trio is optional with the blank-start defaults (flat / material /
 * Roboto), and `language` defaults to 'fr' — absence of an optional key is a
 * choice, never a fault.
 */
import type { Settings } from '../../model/portfolio'
import type { EmbeddedFontFace } from '../../model/theme'
import { FONT_FACE_STYLES, LANGUAGES, PALETTES, THEME_STYLES } from '../../model/theme'
import type { Errors } from './json'
import { at, bool, checkKeys, enumVal, fail, list, optStr, record, str } from './json'

/** Inline-logo guard (~300 KB of binary once base64-encoded): keeps the JSON portable. */
export const LOGO_MAX_CHARS = 400_000

/** Per-face guard on the `dataUri` LENGTH (~400 KB of binary once base64-encoded) —
 * the cap is measured on the string, never by decoding bytes (core stays
 * binary-free). One woff2 text face fits comfortably; a whole TTF does not. */
export const FONT_FACE_MAX_CHARS = 550_000

/** Guard on ALL embedded faces together (~1.5 MB of binary): a family in four
 * weights stays portable; the portfolio must remain a data file, not an archive. */
export const FONT_FACES_TOTAL_MAX_CHARS = 2_000_000

/**
 * Exact shape of an embedded face's `dataUri`: the woff2 MIME, then clean
 * base64 (charset + `=` padding only). A SECURITY line like {@link FONT_NAME}:
 * the string is re-emitted verbatim inside `@font-face` CSS (live document and
 * standalone export), so nothing beyond the base64 alphabet may enter.
 */
const FONT_FACE_DATA_URI = /^data:font\/woff2;base64,[A-Za-z0-9+/]+={0,2}$/

/** `weight` descriptor: one integer 400–800, or an ascending "min max" pair. */
const FONT_WEIGHT_SHAPE = /^(\d{3})(?: (\d{3}))?$/

const isValidWeight = (weight: string): boolean => {
  const m = FONT_WEIGHT_SHAPE.exec(weight)
  if (m === null) return false
  const min = Number(m[1])
  const max = m[2] === undefined ? min : Number(m[2])
  return min >= 400 && max <= 800 && min <= max
}

/**
 * The `fontFaces` collection — `undefined` when absent OR EMPTY (absence is
 * the meaningful "none embedded" state, and `[]` says exactly that — same
 * normalisation as `optStr`). Every face collects all its violations; the
 * total cap is judged on the faces whose `dataUri` was accepted.
 */
function parseFontFaces(
  x: unknown,
  path: string,
  errors: Errors,
): readonly EmbeddedFontFace[] | undefined {
  const items = list(x, path, errors)
  if (items === undefined) return undefined
  const faces: EmbeddedFontFace[] = []
  let total = 0
  items.forEach((raw, i) => {
    const itemPath = `${path}[${i}]`
    const o = record(raw, itemPath, errors)
    if (o === undefined) return
    checkKeys(o, itemPath, ['family', 'dataUri'], ['weight', 'style'], errors)

    const familyPath = at(itemPath, 'family')
    let family = str(o['family'], familyPath, errors)
    if (family !== undefined && !FONT_NAME.test(family)) {
      fail(errors, familyPath, 'invalidFont', { value: family.slice(0, 64) })
      family = undefined
    }

    const weightPath = at(itemPath, 'weight')
    let weight = str(o['weight'], weightPath, errors)
    if (weight !== undefined && !isValidWeight(weight)) {
      fail(errors, weightPath, 'invalidFontWeight', { value: weight.slice(0, 16) })
      weight = undefined
    }

    const style = enumVal(o['style'], FONT_FACE_STYLES, at(itemPath, 'style'), errors)

    const uriPath = at(itemPath, 'dataUri')
    let dataUri = str(o['dataUri'], uriPath, errors)
    if (dataUri !== undefined && !FONT_FACE_DATA_URI.test(dataUri)) {
      fail(errors, uriPath, 'invalidFontFace')
      dataUri = undefined
    } else if (dataUri !== undefined && dataUri.length > FONT_FACE_MAX_CHARS) {
      fail(errors, uriPath, 'oversizedFontFace', {
        max: String(Math.round(FONT_FACE_MAX_CHARS / 1000)),
      })
      dataUri = undefined
    }

    if (dataUri !== undefined) total += dataUri.length
    faces.push({
      family: family ?? '',
      weight: weight ?? '400',
      style: style ?? 'normal',
      dataUri: dataUri ?? '',
    })
  })
  if (total > FONT_FACES_TOTAL_MAX_CHARS) {
    fail(errors, path, 'oversizedFontFaces', {
      max: String(Math.round(FONT_FACES_TOTAL_MAX_CHARS / 1000)),
    })
  }
  return faces.length === 0 ? undefined : faces
}

/**
 * Font families are letters, digits, spaces, `_` and `-` (64 chars max) — the
 * charset Google Fonts names actually use. The bound is a SECURITY line, not
 * taste: the name is re-emitted inside the exported deck's `<style>` (raw-text
 * context), so `<`, `>`, quotes and the like are refused at the door.
 */
export const FONT_NAME = /^[A-Za-z0-9 _-]{1,64}$/

/** Parses the `settings` block, collecting every violation. */
export function parseSettings(x: unknown, errors: Errors): Settings {
  const root = record(x, 'settings', errors)
  if (root)
    checkKeys(root, 'settings', ['identity', 'show', 'recapRows'], ['language', 'theme'], errors)
  const o = root ?? {}

  /* ---- identity (required: org, unit) ---- */
  const identityPath = at('settings', 'identity')
  const identityBlock = record(o['identity'], identityPath, errors)
  if (identityBlock) {
    checkKeys(
      identityBlock,
      identityPath,
      ['org', 'unit'],
      ['orgLong', 'unitLong', 'contact', 'logo'],
      errors,
    )
  }
  const rawIdentity = identityBlock ?? {}
  const logoPath = at(identityPath, 'logo')
  let logo = optStr(rawIdentity['logo'], logoPath, errors)
  if (logo !== undefined && !/^data:image\//.test(logo)) {
    fail(errors, logoPath, 'invalidLogo')
    logo = undefined
  } else if (logo !== undefined && logo.length > LOGO_MAX_CHARS) {
    fail(errors, logoPath, 'oversizedLogo', { max: String(Math.round(LOGO_MAX_CHARS / 1000)) })
    logo = undefined
  }

  /* ---- theme (optional, defaulted) ---- */
  const themePath = at('settings', 'theme')
  const themeBlock = record(o['theme'], themePath, errors)
  if (themeBlock)
    checkKeys(themeBlock, themePath, [], ['style', 'palette', 'font', 'fontFaces'], errors)
  const th = themeBlock ?? {}
  const fontPath = at(themePath, 'font')
  let font = optStr(th['font'], fontPath, errors)
  if (font !== undefined && !FONT_NAME.test(font)) {
    fail(errors, fontPath, 'invalidFont', { value: font.slice(0, 64) })
    font = undefined
  }
  const fontFaces = parseFontFaces(th['fontFaces'], at(themePath, 'fontFaces'), errors)

  /* ---- show (required, all four toggles) ---- */
  const showPath = at('settings', 'show')
  const showBlock = record(o['show'], showPath, errors)
  if (showBlock) {
    checkKeys(
      showBlock,
      showPath,
      ['healthDashboard', 'recap', 'archives', 'decisions'],
      [],
      errors,
    )
  }
  const show = showBlock ?? {}

  /* ---- recapRows (required, integer 6–16) ---- */
  const rawRows = o['recapRows']
  let recapRows = 11
  if (rawRows !== undefined) {
    if (typeof rawRows === 'number' && Number.isInteger(rawRows) && rawRows >= 6 && rawRows <= 16) {
      recapRows = rawRows
    } else {
      fail(errors, at('settings', 'recapRows'), 'invalidRecapRows', { value: String(rawRows) })
    }
  }

  return {
    language: enumVal(o['language'], LANGUAGES, at('settings', 'language'), errors) ?? 'fr',
    identity: {
      org: str(rawIdentity['org'], at(identityPath, 'org'), errors) ?? '',
      unit: str(rawIdentity['unit'], at(identityPath, 'unit'), errors) ?? '',
      orgLong: optStr(rawIdentity['orgLong'], at(identityPath, 'orgLong'), errors),
      unitLong: optStr(rawIdentity['unitLong'], at(identityPath, 'unitLong'), errors),
      contact: optStr(rawIdentity['contact'], at(identityPath, 'contact'), errors),
      logo,
    },
    theme: {
      style: enumVal(th['style'], THEME_STYLES, at(themePath, 'style'), errors) ?? 'flat',
      palette: enumVal(th['palette'], PALETTES, at(themePath, 'palette'), errors) ?? 'material',
      font: font ?? 'Roboto',
      // The key is spread in only when faces exist: an export must stay
      // byte-identical for a portfolio that embeds nothing.
      ...(fontFaces === undefined ? {} : { fontFaces }),
    },
    show: {
      healthDashboard:
        bool(show['healthDashboard'], at(showPath, 'healthDashboard'), errors) ?? true,
      recap: bool(show['recap'], at(showPath, 'recap'), errors) ?? true,
      archives: bool(show['archives'], at(showPath, 'archives'), errors) ?? true,
      decisions: bool(show['decisions'], at(showPath, 'decisions'), errors) ?? true,
    },
    recapRows,
  }
}
