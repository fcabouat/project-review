/**
 * Pins the palette service (`src/palette.ts`) — the twelve category colors a
 * PORTFOLIO can carry, turned into the same `--cat-*` custom properties the
 * built-in families declare. Two promises are tested here: the emission
 * re-checks the hex shape (the value lands verbatim in CSS), and dropping the
 * palette REMOVES the properties rather than leaving stale ones behind.
 */
import { describe, expect, it } from 'vitest'
import { COLORS } from '@project-review/core/model/category'
import type { CustomPalette } from '@project-review/core/model/theme'
import { applyCustomPalette, customPaletteCss, customPaletteEntries } from '../src/palette'

/** A complete, valid table — the twelve names of the domain. */
const palette = (over: Partial<Record<string, string>> = {}): CustomPalette => ({
  label: 'House',
  colors: {
    blue: '#3460d8',
    indigo: '#7a4ecf',
    teal: '#017661',
    cyan: '#016770',
    green: '#027a1f',
    olive: '#666f02',
    amber: '#7e5e01',
    orange: '#a35301',
    red: '#c52b30',
    purple: '#a43cab',
    brown: '#7d4e2c',
    taupe: '#6b6456',
    ...over,
  } as CustomPalette['colors'],
})

/** A fake root exposing exactly what `applyCustomPalette` touches. */
const fakeDoc = () => {
  const vars = new Map<string, string>()
  const doc = {
    documentElement: {
      style: {
        setProperty: (k: string, v: string) => void vars.set(k, v),
        removeProperty: (k: string) => void vars.delete(k),
      },
    },
  } as unknown as Document
  return { doc, vars }
}

describe('palette service', () => {
  it('emits the twelve properties, in the domain order', () => {
    const entries = customPaletteEntries(palette())
    expect(entries).toHaveLength(12)
    expect(entries.map(([name]) => name)).toEqual(COLORS.map((c) => `--cat-${c}`))
    expect(entries[0]).toEqual(['--cat-blue', '#3460d8'])
  })

  it('customPaletteCss: one :root rule, empty for an absent palette', () => {
    expect(customPaletteCss(palette())).toContain(':root{--cat-blue:#3460d8;')
    expect(customPaletteCss(palette())).toContain('--cat-taupe:#6b6456}')
    expect(customPaletteCss(undefined)).toBe('')
  })

  /**
   * The emission re-check, belt to the parse's brace: these values could only
   * come from a hand-built model, and each one would break out of the CSS
   * declaration it is written into. A refused colour is SKIPPED — the family
   * underneath shows through — never emitted and never thrown on.
   */
  it('skips any value that is not an exact six-digit hex', () => {
    for (const bad of ['#abc', '#3460d8ff', 'red', 'var(--x)', '#3460d8;}', '']) {
      const entries = customPaletteEntries(palette({ blue: bad }))
      expect(entries).toHaveLength(11)
      expect(entries.map(([name]) => name)).not.toContain('--cat-blue')
    }
  })

  it('tolerates a table missing names, or missing altogether', () => {
    const partial = { colors: { blue: '#3460d8' } } as unknown as CustomPalette
    expect(customPaletteEntries(partial)).toEqual([['--cat-blue', '#3460d8']])
    expect(customPaletteEntries({} as CustomPalette)).toEqual([])
  })

  it('applyCustomPalette: sets the twelve properties on the root', () => {
    const { doc, vars } = fakeDoc()
    applyCustomPalette(palette(), doc)
    expect(vars.size).toBe(12)
    expect(vars.get('--cat-red')).toBe('#c52b30')
  })

  /* The reversibility that makes the precedence rule true: with no palette of
     its own, the portfolio must fall back on the family it names — which only
     works if nothing of the previous palette is left on the root. */
  it('applyCustomPalette: dropping the palette removes every property', () => {
    const { doc, vars } = fakeDoc()
    applyCustomPalette(palette(), doc)
    applyCustomPalette(undefined, doc)
    expect(vars.size).toBe(0)
  })

  it('applyCustomPalette: a refused colour is removed, not left stale', () => {
    const { doc, vars } = fakeDoc()
    applyCustomPalette(palette(), doc)
    applyCustomPalette(palette({ blue: 'not a colour' }), doc)
    expect(vars.has('--cat-blue')).toBe(false)
    expect(vars.size).toBe(11)
  })

  it('is safe outside a browser', () => {
    expect(() => applyCustomPalette(palette(), undefined)).not.toThrow()
  })
})
