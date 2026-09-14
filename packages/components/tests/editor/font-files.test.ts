/**
 * Pins the file-name → face mapping of the font picker
 * (`src/editor/font-files.ts`): the variant table mirrors the deployed-family
 * files the Settings card documents, and anything unusable proposes nothing.
 */
import { describe, expect, it } from 'vitest'
import { faceFromFileName, faceSizeKb } from '../../src/editor/font-files'

describe('faceFromFileName — the deployment idiom, read from names', () => {
  it('maps the documented deployment trio exactly as the Settings hint states', () => {
    expect(faceFromFileName('Atelier-Regular.woff2')).toEqual({
      family: 'Atelier',
      weight: '400',
      style: 'normal',
    })
    expect(faceFromFileName('Atelier-Medium.woff2')).toEqual({
      family: 'Atelier',
      weight: '500',
      style: 'normal',
    })
    expect(faceFromFileName('Atelier-Bold.woff2')).toEqual({
      family: 'Atelier',
      weight: '700',
      style: 'normal',
    })
  })

  it('reads italics, combined variants, and the longest suffix first', () => {
    expect(faceFromFileName('Atelier-Italic.woff2')?.style).toBe('italic')
    expect(faceFromFileName('Atelier-BoldItalic.woff2')).toEqual({
      family: 'Atelier',
      weight: '700',
      style: 'italic',
    })
    // ExtraBold must not be read as "Extra" + Bold.
    expect(faceFromFileName('Inter_ExtraBold.woff2')).toEqual({
      family: 'Inter',
      weight: '800',
      style: 'normal',
    })
    expect(faceFromFileName('Face-SemiBold.woff2')?.weight).toBe('600')
    expect(faceFromFileName('Face-Black.woff2')?.weight).toBe('900')
  })

  it('preserves static lighter weights so directory imports keep distinct slots', () => {
    expect(faceFromFileName('Face-Light.woff2')?.weight).toBe('300')
    expect(faceFromFileName('Face-Thin.woff2')?.weight).toBe('100')
    expect(faceFromFileName('Face-300.woff2')?.weight).toBe('300')
  })

  it('derives multi-word families and defaults a bare name to 400/normal', () => {
    expect(faceFromFileName('IBM-Plex-Sans-Bold.woff2')).toEqual({
      family: 'IBM Plex Sans',
      weight: '700',
      style: 'normal',
    })
    expect(faceFromFileName('Atelier.woff2')).toEqual({
      family: 'Atelier',
      weight: '400',
      style: 'normal',
    })
  })

  it('only reads the base name of a directory pick, case-insensitively', () => {
    expect(faceFromFileName('fonts/atelier/Atelier-Bold.WOFF2')?.family).toBe('Atelier')
  })

  it('proposes nothing for non-woff2 names or names with no family left', () => {
    expect(faceFromFileName('Atelier-Bold.ttf')).toBeUndefined()
    expect(faceFromFileName('Atelier-Bold.woff')).toBeUndefined()
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
