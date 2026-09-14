/**
 * i18n — the catalog SERVICE: access and processing over the pure
 * FR/EN message tables (`data/catalog.fr.ts` / `data/catalog.en.ts`, zero
 * logic). This module holds the key type, `t()` with its interpolation and
 * the clockless date formatters. No hard-coded label in templates: everything
 * goes through `t()`.
 *
 * Keys are English; the DISPLAY strings themselves are part of the frozen
 * content contract and stay exactly as they are, in both languages.
 */
import type { CoversExactly } from '../values/refine'
import type { Language } from '../model/theme'
import { UNSORTED_CATEGORY } from '../model/category'
import { CATALOG_FR, MONTHS_FR } from '../data/catalog.fr'
import { CATALOG_EN, MONTHS_EN } from '../data/catalog.en'

/** A key that provably exists in BOTH message files — inferred from the French
 * one, pinned to the English one below; never hand-kept. */
export type CatalogKey = keyof typeof CATALOG_FR

// The two message files carry exactly the same keys — a compile error here
// means one of them gained or lost an entry alone.
const _sameKeys: CoversExactly<keyof typeof CATALOG_EN, CatalogKey> = true

const CATALOGS: Record<Language, Record<CatalogKey, string>> = {
  fr: CATALOG_FR,
  en: CATALOG_EN,
}

/** Values for the `{name}` placeholders of a catalog string. Filling is plain
 * text substitution (split/join): no escaping, no formatting, no plural rules —
 * the catalog strings carry their own pluralisation ("jalon(s)"). */
export type Slots = Readonly<Record<string, string | number>>

/** `true` when the (runtime) key resolves to a real catalog entry. */
export function isCatalogKey(key: string): key is CatalogKey {
  return Object.hasOwn(CATALOG_FR, key)
}

/** Total: unknown key → the key itself (visible, never an exception). */
export function t(key: CatalogKey, language: Language, slots?: Slots): string {
  let text: string = isCatalogKey(key) ? CATALOGS[language][key] : key
  if (slots) {
    for (const [name, value] of Object.entries(slots)) {
      text = text.split(`{${name}}`).join(String(value))
    }
  }
  return text
}

/**
 * Display name of the implicit "unsorted" category: `UNSORTED_CATEGORY.name`
 * carries the catalog key, this resolves it in the deck's language.
 */
export function unsortedCategoryName(language: Language): string {
  return t(UNSORTED_CATEGORY.name as CatalogKey, language)
}

/* -------------------------- Dates (clockless) --------------------------- */

/** `2026-09-03` → `03/09/26` (same fr/en — short format shared by tables). */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y.slice(2)}`
}

/** `2026-09-03` → "3 septembre 2026" / "3 September 2026". */
export function formatLongDate(iso: string, language: Language): string {
  const [y, m, d] = iso.split('-')
  const idx = Number(m) - 1
  const month = language === 'fr' ? MONTHS_FR[idx] : MONTHS_EN[idx]
  if (!y || !d || month === undefined) return iso
  return `${Number(d)} ${month} ${y}`
}
