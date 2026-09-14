/**
 * Settings commands — the intent variants of the settings side: one variant
 * per identity field / flattened setting, typed value, no `before` (see the
 * commands barrel, index.ts).
 */
import type { Identity } from '../model/portfolio'
import type { IdentityField, SettingKey, SettingValues } from '../events/settings'

/** Set one identity field (one variant per field, typed value). */
export type ChangeIdentityField = {
  readonly [F in IdentityField]: {
    readonly type: 'ChangeIdentityField'
    readonly field: F
    readonly after: Identity[F]
  }
}[IdentityField]

/** Set one flattened setting (one variant per setting, typed value). */
export type ChangeSetting = {
  readonly [K in SettingKey]: {
    readonly type: 'ChangeSetting'
    readonly setting: K
    readonly after: SettingValues[K]
  }
}[SettingKey]
