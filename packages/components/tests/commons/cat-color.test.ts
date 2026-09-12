/**
 * Pins the category color lookup (`src/commons/cat-color.ts`) — the one
 * bridge between the core's generic color names and the palette-scoped CSS
 * custom properties (`palettes.css`). The mapping is mechanical on purpose:
 * this test freezes its shape so a palette rework cannot silently change the
 * variable contract every slide and swatch relies on.
 */
import { describe, expect, it } from 'vitest'
import { COLORS } from '@project-review/core/model/category'
import { catColor } from '../../src/commons/cat-color'

describe('catColor', () => {
  it('maps a category color to its palette-scoped custom property', () => {
    expect(catColor('blue')).toBe('var(--cat-blue)')
  })

  it('covers all 12 contract colors with the same var(--cat-*) shape', () => {
    for (const color of COLORS) {
      expect(catColor(color)).toBe(`var(--cat-${color})`)
    }
  })

  it('resolves the unsorted sentinel grey — the one non-contract color', () => {
    expect(catColor('grey')).toBe('var(--cat-grey)')
  })
})
