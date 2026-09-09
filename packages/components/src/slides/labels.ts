/**
 * Label helpers shared by the templates. Presentation only: everything comes
 * from the i18n catalog or from a formatted date — not one generated string is
 * spelled out here, in any language.
 */
import type { Category, UnsortedCategory } from '@project-review/core/model/category'
import type { Language } from '@project-review/core/model/theme'
import { UNSORTED_CATEGORY } from '@project-review/core/model/category'
import {
  formatLongDate,
  t,
  unsortedCategoryName,
  type CatalogKey,
} from '@project-review/core/services/i18n'

/** French typography: a non-breaking space before the colon. */
const NBSP = ' '

/**
 * "Porteur" → "Porteur : " (fr, NBSP before the colon) / "Lead" → "Lead: " (en)
 * — for GENERATED labels only, never entered text. The colon is typography, so
 * it follows the deck's language like every other generated glyph.
 */
export function withColon(label: string, language: Language): string {
  return language === 'fr' ? `${label}${NBSP}: ` : `${label}: `
}

/** Same thing straight from a catalog key. */
export function fieldLabel(key: CatalogKey, language: Language): string {
  return withColon(t(key, language), language)
}

/**
 * Display name of a category. The implicit "unsorted" sentinel carries a
 * catalog KEY in `name` — it resolves in the deck's language here,
 * never shown raw.
 */
export function categoryName(category: Category | UnsortedCategory, language: Language): string {
  return category.id === UNSORTED_CATEGORY.id ? unsortedCategoryName(language) : category.name
}

/**
 * Slide foot, left: the month of the review. Derived from the long date rather
 * than from a month table of our own — `formatLongDate` already owns that
 * knowledge, in both languages.
 */
export function monthLabel(iso: string, language: Language): string {
  const parts = formatLongDate(iso, language).split(' ')
  const month = parts[1]
  const year = parts[2]
  if (month === undefined || year === undefined) return iso
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`
}

/**
 * Column headers: the catalog holds them as one " · "-separated line per table
 * (`recap.columns`, `decisions.columns`), which keeps the two languages in
 * step in a single entry. Splitting is the presentation's job.
 */
export function columns(key: CatalogKey, language: Language): readonly string[] {
  return t(key, language).split(' · ')
}

/** Vertical rail: the review title, then the section, in that order. */
export function railText(language: Language, section?: string): string {
  const base = t('sidebar.review', language)
  return section ? `${base} · ${section}` : base
}
