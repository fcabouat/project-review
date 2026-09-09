/**
 * Pins the display fallback (`src/commons/display.ts`) — empty entered labels
 * (milestone label, free-slide title) show as "—", real text passes through.
 */
import { describe, expect, it } from 'vitest'
import { displayLabel } from '../../src/commons/display'

describe('displayLabel — the "—" fallback for empty entered labels', () => {
  it('shows the dash for an empty, blank or absent label', () => {
    expect(displayLabel('')).toBe('—')
    expect(displayLabel('   ')).toBe('—')
    expect(displayLabel(undefined)).toBe('—')
  })

  it('passes any real text through untouched', () => {
    expect(displayLabel('Go / no-go')).toBe('Go / no-go')
    expect(displayLabel('—')).toBe('—')
  })
})
