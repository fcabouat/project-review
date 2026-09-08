/**
 * Pins `parseLine` (`src/model/text-line.ts`) — the TextLine micro-format of
 * the narrative bullets: `**bold**`, the " — " suffix split, and totality
 * (malformed markup renders as-is, never throws).
 */
import { describe, expect, it } from 'vitest'
import { parseLine } from '../../src/model/text-line'

describe('TextLine micro-format', () => {
  it('plain line', () => {
    expect(parseLine('Inventaire du parc existant')).toEqual({
      segments: [{ bold: false, text: 'Inventaire du parc existant' }],
    })
  })

  it('bold', () => {
    expect(parseLine('Installation du **site pilote** au siège').segments).toEqual([
      { bold: false, text: 'Installation du ' },
      { bold: true, text: 'site pilote' },
      { bold: false, text: ' au siège' },
    ])
  })

  it('suffix on the last " — "', () => {
    const l = parseLine('Bascule — préparation — 15 VM')
    expect(l.segments).toEqual([{ bold: false, text: 'Bascule — préparation' }])
    expect(l.suffix).toBe('15 VM')
  })

  it('bold + suffix combined', () => {
    const l = parseLine('**Test de restauration complète** — 12/26')
    expect(l.segments).toEqual([{ bold: true, text: 'Test de restauration complète' }])
    expect(l.suffix).toBe('12/26')
  })

  it('"k€" and glued dashes trigger nothing', () => {
    expect(parseLine('Arbitrer 18 k€ après-demain').suffix).toBeUndefined()
    expect(parseLine('Franco-allemand').suffix).toBeUndefined()
  })

  it('odd number of "**" → literal (total parse)', () => {
    expect(parseLine('a ** b').segments).toEqual([{ bold: false, text: 'a ** b' }])
  })

  it('separator at the start or end of the line: no suffix', () => {
    expect(parseLine(' — orphelin').suffix).toBeUndefined()
    expect(parseLine('fin — ').suffix).toBeUndefined()
  })

  it('empty string', () => {
    expect(parseLine('')).toEqual({ segments: [{ bold: false, text: '' }] })
  })
})
