/**
 * Pins the file-name → face mapping of the font picker
 * (`src/editor/font-files.ts`): the variant table mirrors the served-Marianne
 * files the Settings card documents, and anything unusable proposes nothing.
 */
import { describe, expect, it } from 'vitest'
import { faceFromFileName, faceSizeKb } from '../../src/editor/font-files'

describe('faceFromFileName — the deployment idiom, read from names', () => {
  it('maps the documented Marianne trio exactly as the served hint states', () => {
    expect(faceFromFileName('Marianne-Regular.woff2')).toEqual({
      family: 'Marianne',
      weight: '400',
      style: 'normal',
    })
    expect(faceFromFileName('Marianne-Medium.woff2')).toEqual({
      family: 'Marianne',
      weight: '500 600',
      style: 'normal',
    })
    expect(faceFromFileName('Marianne-Bold.woff2')).toEqual({
      family: 'Marianne',
      weight: '700 800',
      style: 'normal',
    })
  })

  it('reads italics, combined variants, and the longest suffix first', () => {
    expect(faceFromFileName('Marianne-Italic.woff2')?.style).toBe('italic')
    expect(faceFromFileName('Marianne-BoldItalic.woff2')).toEqual({
      family: 'Marianne',
      weight: '700 800',
      style: 'italic',
    })
    // ExtraBold must not be read as "Extra" + Bold.
    expect(faceFromFileName('Inter_ExtraBold.woff2')).toEqual({
      family: 'Inter',
      weight: '800',
      style: 'normal',
    })
    expect(faceFromFileName('Face-SemiBold.woff2')?.weight).toBe('600')
    expect(faceFromFileName('Face-Black.woff2')?.weight).toBe('800')
  })

  it('clamps lighter-than-400 variants to 400 — the deck range starts there', () => {
    expect(faceFromFileName('Face-Light.woff2')?.weight).toBe('400')
    expect(faceFromFileName('Face-Thin.woff2')?.weight).toBe('400')
  })

  it('derives multi-word families and defaults a bare name to 400/normal', () => {
    expect(faceFromFileName('IBM-Plex-Sans-Bold.woff2')).toEqual({
      family: 'IBM Plex Sans',
      weight: '700 800',
      style: 'normal',
    })
    expect(faceFromFileName('Marianne.woff2')).toEqual({
      family: 'Marianne',
      weight: '400',
      style: 'normal',
    })
  })

  it('only reads the base name of a directory pick, case-insensitively', () => {
    expect(faceFromFileName('fonts/marianne/Marianne-Bold.WOFF2')?.family).toBe('Marianne')
  })

  it('proposes nothing for non-woff2 names or names with no family left', () => {
    expect(faceFromFileName('Marianne-Bold.ttf')).toBeUndefined()
    expect(faceFromFileName('Marianne-Bold.woff')).toBeUndefined()
    expect(faceFromFileName('.woff2')).toBeUndefined()
    expect(faceFromFileName('-regular.woff2')).toBeUndefined()
    expect(faceFromFileName('éàç.woff2')).toBeUndefined() // outside the font charset
  })
})

describe('faceSizeKb — the listed size', () => {
  it('reports ~3/4 of the base64 payload, floored at 1 KB', () => {
    expect(faceSizeKb(`data:font/woff2;base64,${'A'.repeat(4096)}`)).toBe(3)
    expect(faceSizeKb('data:font/woff2;base64,d09GMg==')).toBe(1)
  })
})
