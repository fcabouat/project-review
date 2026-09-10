/**
 * `settings` block — identity, theme, display toggles. The identity and the
 * four `show` toggles are required (they ARE the "organization kit"); the
 * theme trio is optional with the blank-start defaults (flat / material /
 * Roboto), and `language` defaults to 'fr' — absence of an optional key is a
 * choice, never a fault.
 *
 * The VALUE rules this block enforces (font family, face weight, woff2 data
 * URI, inline logo, palette color, recap band) are not written here: they live in `values/`,
 * because the commands the editor emits must obey the very same ones
 * (commands/contract.ts). Read once, judged identically on both sides.
 */
import type { Color } from '../../model/category'
import { COLORS } from '../../model/category'
import type { Settings } from '../../model/portfolio'
import type { CustomPalette, EmbeddedFontFace } from '../../model/theme'
import { FONT_FACE_STYLES, LANGUAGES, PALETTES, THEME_STYLES } from '../../model/theme'
import {
  FONT_FACE_MAX_CHARS,
  FONT_FACES_TOTAL_MAX_CHARS,
  isFontFamily,
  isFontWeight,
  isWoff2DataUri,
} from '../../values/font'
import { LOGO_MAX_CHARS, isImageDataUri } from '../../values/logo'
import { isHexColor } from '../../values/palette'
import { isRecapRows } from '../../values/recap-rows'
import type { Errors } from './json'
import { at, bool, checkKeys, enumVal, fail, list, optStr, record, str } from './json'

// The rules themselves live in values/ — one statement, read here at the door
// and in `commands/contract.ts` when the editor emits: what the parse refuses,
// no command may produce (docs/overview.md, the memory/file contract).
export { FONT_FACE_MAX_CHARS, FONT_FACES_TOTAL_MAX_CHARS } from '../../values/font'
export { LOGO_MAX_CHARS } from '../../values/logo'

/** Stand-in for a palette color the format refused. It never reaches a caller:
 * the errors it travels with turn the whole read into a refusal — it exists so
 * the parse can go on and report EVERY faulty color in one pass. */
const PLACEHOLDER_COLOR = '#000000'

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
    if (family !== undefined && !isFontFamily(family)) {
      fail(errors, familyPath, 'invalidFont', { value: family.slice(0, 64) })
      family = undefined
    }

    const weightPath = at(itemPath, 'weight')
    let weight = str(o['weight'], weightPath, errors)
    if (weight !== undefined && !isFontWeight(weight)) {
      fail(errors, weightPath, 'invalidFontWeight', { value: weight.slice(0, 16) })
      weight = undefined
    }

    const style = enumVal(o['style'], FONT_FACE_STYLES, at(itemPath, 'style'), errors)

    const uriPath = at(itemPath, 'dataUri')
    let dataUri = str(o['dataUri'], uriPath, errors)
    if (dataUri !== undefined && !isWoff2DataUri(dataUri)) {
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
 * The `customPalette` block — the twelve category colors the PORTFOLIO carries
 * itself, `undefined` when absent (the meaningful "no palette of its own"
 * state, so an export without one stays byte-identical).
 *
 * The collection is EXHAUSTIVE, and that is the point: `checkKeys` demands the
 * twelve names of the domain and refuses any thirteenth, so a palette can
 * never leave one category silently on another family's hue. Each value is
 * then judged by the one rule (`isHexColor`) the editor's commands are judged
 * by. A value the format refuses is replaced by a placeholder that no caller
 * ever sees: a non-empty error list makes the whole read a refusal.
 */
function parseCustomPalette(x: unknown, path: string, errors: Errors): CustomPalette | undefined {
  const block = record(x, path, errors)
  if (block === undefined) return undefined
  checkKeys(block, path, ['colors'], ['label'], errors)
  const label = optStr(block['label'], at(path, 'label'), errors)

  const colorsPath = at(path, 'colors')
  const table = record(block['colors'], colorsPath, errors)
  if (table !== undefined) checkKeys(table, colorsPath, COLORS, [], errors)

  const colors = {} as Record<Color, string>
  for (const name of COLORS) {
    const valuePath = at(colorsPath, name)
    const value = str(table?.[name], valuePath, errors)
    if (value !== undefined && !isHexColor(value)) {
      fail(errors, valuePath, 'invalidPaletteColor', { value: value.slice(0, 16) })
    }
    colors[name] = value !== undefined && isHexColor(value) ? value : PLACEHOLDER_COLOR
  }
  return { ...(label === undefined ? {} : { label }), colors }
}

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
  if (logo !== undefined && !isImageDataUri(logo)) {
    fail(errors, logoPath, 'invalidLogo')
    logo = undefined
  } else if (logo !== undefined && logo.length > LOGO_MAX_CHARS) {
    fail(errors, logoPath, 'oversizedLogo', { max: String(Math.round(LOGO_MAX_CHARS / 1000)) })
    logo = undefined
  }

  /* ---- theme (optional, defaulted) ---- */
  const themePath = at('settings', 'theme')
  const themeBlock = record(o['theme'], themePath, errors)
  if (themeBlock) {
    checkKeys(
      themeBlock,
      themePath,
      [],
      ['style', 'palette', 'font', 'fontFaces', 'customPalette'],
      errors,
    )
  }
  const th = themeBlock ?? {}
  const fontPath = at(themePath, 'font')
  let font = optStr(th['font'], fontPath, errors)
  if (font !== undefined && !isFontFamily(font)) {
    fail(errors, fontPath, 'invalidFont', { value: font.slice(0, 64) })
    font = undefined
  }
  const fontFaces = parseFontFaces(th['fontFaces'], at(themePath, 'fontFaces'), errors)
  const customPalette = parseCustomPalette(
    th['customPalette'],
    at(themePath, 'customPalette'),
    errors,
  )

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

  /* ---- recapRows (required, integer in the printable band) ---- */
  const rawRows = o['recapRows']
  let recapRows = 11
  if (rawRows !== undefined) {
    if (typeof rawRows === 'number' && isRecapRows(rawRows)) {
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
      // The keys are spread in only when the file carried them: an export
      // must stay byte-identical for a portfolio that carries nothing.
      ...(fontFaces === undefined ? {} : { fontFaces }),
      ...(customPalette === undefined ? {} : { customPalette }),
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
