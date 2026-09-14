/**
 * Pins the slide-label helpers (`src/slides/labels.ts`) — language-aware
 * typography (the French NBSP colon), sentinel resolution, and the catalog
 * lines the slide templates split into columns.
 */
import { describe, expect, it } from 'vitest'
import { UNSORTED_CATEGORY } from '@project-review/core/model/category'
import { categoryId } from '@project-review/core/values/ids'
import {
  categoryName,
  columns,
  fieldLabel,
  monthLabel,
  railText,
  withColon,
} from '../../src/slides/labels'

const NBSP = ' '

describe('withColon — the colon follows the language', () => {
  it('french: NBSP before the colon', () => {
    expect(withColon('Porteur', 'fr')).toBe(`Porteur${NBSP}: `)
  })

  it('english: plain colon, no french typography', () => {
    expect(withColon('Lead', 'en')).toBe('Lead: ')
  })

  it('fieldLabel goes through the catalog AND the language-aware colon', () => {
    expect(fieldLabel('sheet.lead', 'fr')).toBe(`Porteur${NBSP}: `)
    expect(fieldLabel('sheet.lead', 'en')).toBe('Lead: ')
  })
})

describe('categoryName — the unsorted sentinel resolves, real names pass through', () => {
  it('resolves the sentinel in both languages, never showing the raw key', () => {
    expect(categoryName(UNSORTED_CATEGORY, 'fr')).toBe('À classer')
    expect(categoryName(UNSORTED_CATEGORY, 'en')).toBe('Uncategorised')
    expect(categoryName(UNSORTED_CATEGORY, 'fr')).not.toBe(UNSORTED_CATEGORY.name)
  })

  it('returns a real category name untouched', () => {
    expect(
      categoryName({ id: categoryId('infra')!, name: 'Infrastructure', color: 'blue' }, 'en'),
    ).toBe('Infrastructure')
  })

  it('keeps the chosen name of a real category whose id is unsorted', () => {
    const category = { id: categoryId('unsorted')!, name: 'Organisation', color: 'blue' as const }
    for (const language of ['fr', 'en'] as const) {
      expect(categoryName(category, language)).toBe('Organisation')
    }
    expect(categoryName({ ...UNSORTED_CATEGORY }, 'fr')).toBe('À classer')
  })
})

describe('monthLabel — capitalised month + year, from the long date', () => {
  it('speaks both languages', () => {
    expect(monthLabel('2026-09-03', 'fr')).toBe('Septembre 2026')
    expect(monthLabel('2026-09-03', 'en')).toBe('September 2026')
  })

  it('falls back to the raw string when the date cannot be split', () => {
    expect(monthLabel('garbage', 'fr')).toBe('garbage')
  })
})

describe('columns — one catalog line split on " · "', () => {
  it('yields the 8 recap headers in each language', () => {
    expect(columns('recap.columns', 'fr')).toEqual([
      'ID',
      'Projet',
      'Catégorie',
      'Étape',
      'Santé',
      'Avancement',
      'Prochain jalon',
      'Décision',
    ])
    expect(columns('recap.columns', 'en')).toHaveLength(8)
    expect(columns('decisions.columns', 'en')[0]).toBe('Project')
  })
})

describe('railText — review title, then the section', () => {
  it('with and without a section', () => {
    expect(railText('fr')).toBe('Revue des projets')
    expect(railText('en', 'Archives')).toBe('Project review · Archives')
  })
})
