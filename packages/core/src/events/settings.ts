/**
 * Settings events — the editable vocabulary of the settings side (identity
 * fields and flattened settings) and its two events. A setting is a CLOSED
 * path (one key = one setting), never a free-form lodash-style string; types
 * come from `Settings` to forbid any drift.
 */
import type { Identity, Settings } from '../model/portfolio'
import type { CoversExactly } from '../values/refine'

/** Every `Identity` field is editable on its own, from the settings screen. */
export type IdentityField = keyof Identity

/** Runtime mirror of {@link IdentityField}, in form order — same compile-time
 * coverage pin as `REVIEW_FIELDS` (review.ts). */
export const IDENTITY_FIELDS = [
  'org',
  'unit',
  'orgLong',
  'unitLong',
  'contact',
  'logo',
] as const satisfies readonly IdentityField[]

const _identityCovered: CoversExactly<(typeof IDENTITY_FIELDS)[number], IdentityField> = true

/** Flattened settings — the closed write path of `SettingChanged`. */
export type SettingValues = Settings['show'] & {
  readonly language: Settings['language']
  readonly style: Settings['theme']['style']
  readonly palette: Settings['theme']['palette']
  readonly font: Settings['theme']['font']
  /** `undefined` = none embedded — writing it back ERASES the key (apply). */
  readonly fontFaces: Settings['theme']['fontFaces']
  readonly recapRows: Settings['recapRows']
}

/** One flattened setting name — the discriminant of {@link SettingChanged}. */
export type SettingKey = keyof SettingValues

/** Runtime mirror of {@link SettingKey}, in settings-form order — same
 * compile-time coverage pin as `REVIEW_FIELDS` (review.ts). */
export const SETTING_KEYS = [
  'language',
  'style',
  'palette',
  'font',
  'fontFaces',
  'healthDashboard',
  'recap',
  'archives',
  'decisions',
  'recapRows',
] as const satisfies readonly SettingKey[]

const _settingsCovered: CoversExactly<(typeof SETTING_KEYS)[number], SettingKey> = true

/** Current value of one flattened setting — the read mirror of the closed
 * write path in `applySetting` (apply.ts). */
export const settingValue = <K extends SettingKey>(s: Settings, key: K): SettingValues[K] => {
  const flat: SettingValues = {
    language: s.language,
    style: s.theme.style,
    palette: s.theme.palette,
    font: s.theme.font,
    fontFaces: s.theme.fontFaces,
    ...s.show,
    recapRows: s.recapRows,
  }
  return flat[key]
}

/** One identity field, before → after (one variant per field). */
export type IdentityFieldChanged = {
  readonly [F in IdentityField]: {
    readonly type: 'IdentityFieldChanged'
    readonly field: F
    readonly before: Identity[F]
    readonly after: Identity[F]
  }
}[IdentityField]

/** One setting, before → after (one variant per setting). */
export type SettingChanged = {
  readonly [K in SettingKey]: {
    readonly type: 'SettingChanged'
    readonly setting: K
    readonly before: SettingValues[K]
    readonly after: SettingValues[K]
  }
}[SettingKey]
