/**
 * `settings` block — identity, theme, display toggles. The identity and the
 * four `show` toggles are required (they ARE the "organization kit"); the
 * theme trio is optional with the blank-start defaults (flat / material /
 * Roboto), and `language` defaults to 'fr' — absence of an optional key is a
 * choice, never a fault.
 */
import type { Settings } from '../../model/portfolio'
import { LANGUAGES, PALETTES, THEME_STYLES } from '../../model/theme'
import type { Errors } from './json'
import { at, bool, checkKeys, enumVal, fail, optStr, record, str } from './json'

/** Inline-logo guard (~300 KB of binary once base64-encoded): keeps the JSON portable. */
export const LOGO_MAX_CHARS = 400_000

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
  if (themeBlock) checkKeys(themeBlock, themePath, [], ['style', 'palette', 'font'], errors)
  const th = themeBlock ?? {}
  const fontPath = at(themePath, 'font')
  let font = optStr(th['font'], fontPath, errors)
  if (font !== undefined && !FONT_NAME.test(font)) {
    fail(errors, fontPath, 'invalidFont', { value: font.slice(0, 64) })
    font = undefined
  }

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
