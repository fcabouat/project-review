/**
 * Pins the catalog service (`src/services/i18n.ts`) over the fr/en message
 * tables (`src/data/catalog.*.ts`): completeness against the model's closed
 * enumerations, totality of `t()`, and the clockless date formatting.
 */
import { describe, expect, it } from 'vitest'
import { STAGES, HEALTH_LEVELS } from '../../src/model/project'
import { UNSORTED_CATEGORY } from '../../src/model/category'
import { CATALOG_FR } from '../../src/data/catalog.fr'
import { CATALOG_EN } from '../../src/data/catalog.en'
import {
  formatLongDate,
  formatShortDate,
  isCatalogKey,
  t,
  unsortedCategoryName,
  type CatalogKey,
} from '../../src/services/i18n'

describe('catalog', () => {
  it('every stage and every health level has its fr and en label', () => {
    for (const s of STAGES) {
      expect(CATALOG_FR[`stage.${s}`]).toBeTruthy()
      expect(CATALOG_EN[`stage.${s}`]).toBeTruthy()
    }
    for (const l of HEALTH_LEVELS) expect(CATALOG_FR[`level.${l}`]).toBeTruthy()
    expect(CATALOG_FR['level.notAssessed']).toBe('Non évalué')
  })

  it('t(): fr/en + interpolation', () => {
    expect(t('stage.inProgress', 'fr')).toBe('En cours')
    expect(t('stage.inProgress', 'en')).toBe('In progress')
    expect(t('recap.page', 'fr', { page: 1, total: 2 })).toBe('page 1 / 2')
    expect(t('recap.page', 'en', { page: 1, total: 2 })).toBe('page 1 of 2')
    expect(t('d2.more', 'fr', { n: 3 })).toBe('+3 autres')
  })

  it('t() is total: unknown key → the key', () => {
    // The cast bypasses CatalogKey on purpose: totality is a RUNTIME promise.
    expect(t('inconnue.cle' as CatalogKey, 'fr')).toBe('inconnue.cle')
  })

  it('isCatalogKey mirrors the message files', () => {
    expect(isCatalogKey('stage.ready')).toBe(true)
    expect(isCatalogKey('inconnue.cle')).toBe(false)
  })

  it('unsorted category: the sentinel carries a catalog key, resolved per language', () => {
    expect(UNSORTED_CATEGORY.name).toBe('category.unsorted' satisfies CatalogKey)
    expect(unsortedCategoryName('fr')).toBe('À classer')
    expect(unsortedCategoryName('en')).toBe('Uncategorised')
  })

  it('generated French labels carry non-breaking spaces before high punctuation', () => {
    expect(t('recap.title', 'fr')).toContain(' ?')
    expect(t('archives.reminder', 'fr')).toContain(' :')
  })

  it('clockless dates: short and long', () => {
    expect(formatShortDate('2026-09-03')).toBe('03/09/26')
    expect(formatLongDate('2026-09-03', 'fr')).toBe('3 septembre 2026')
    expect(formatLongDate('2026-09-03', 'en')).toBe('3 September 2026')
    expect(formatShortDate('n’importe quoi')).toBe('n’importe quoi')
    expect(formatLongDate('garbage', 'fr')).toBe('garbage') // total: unparsable → as-is
  })
})
