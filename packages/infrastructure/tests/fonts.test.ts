/**
 * Pins the font service (`src/fonts.ts`) — safe stack building, the
 * bundled-vs-Google family split, and the idempotent link injection on a fake
 * document.
 */
import { describe, expect, it } from 'vitest'
import type { EmbeddedFontFace } from '@project-review/core/model/theme'
import {
  EMBEDDED_STYLE_ID,
  applyEmbeddedFonts,
  applyFont,
  asWoff2DataUri,
  embeddedFamilies,
  embeddedFontFaceCss,
  fontLinkId,
  fontStack,
  googleFontsUrl,
  probeFont,
} from '../src/fonts'

describe('font service', () => {
  it('fontStack: Roboto (default) and empty fall back, others are prepended quoted', () => {
    expect(fontStack('Roboto')).toBe("'Roboto', 'Inter', 'Segoe UI', system-ui, sans-serif")
    expect(fontStack('  ')).toBe("'Roboto', 'Inter', 'Segoe UI', system-ui, sans-serif")
    expect(fontStack('Inter')).toBe("'Inter', 'Roboto', 'Segoe UI', system-ui, sans-serif")
    expect(fontStack('Marianne')).toBe(
      "'Marianne', 'Roboto', 'Inter', 'Segoe UI', system-ui, sans-serif",
    )
    expect(fontStack('IBM Plex Sans')).toContain("'IBM Plex Sans', 'Roboto'")
    expect(fontStack('O\'Weird"Name')).toContain("'OWeirdName'") // quotes stripped, never injected
  })

  it('googleFontsUrl: null for bundled families, css2 URL otherwise', () => {
    expect(googleFontsUrl('Roboto')).toBeNull() // bundled since @fontsource/roboto
    expect(googleFontsUrl('Inter')).toBeNull()
    expect(googleFontsUrl('Marianne')).toBeNull()
    expect(googleFontsUrl('IBM Plex Sans')).toBe(
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&display=swap',
    )
  })

  it('applyFont: sets the variable, injects the link once, tolerates no document', () => {
    const links: Array<{ id: string; rel: string; href: string }> = []
    const vars = new Map<string, string>()
    const fake = {
      documentElement: { style: { setProperty: (k: string, v: string) => void vars.set(k, v) } },
      getElementById: (id: string) => links.find((l) => l.id === id) ?? null,
      createElement: () => ({ id: '', rel: '', href: '' }),
      head: { appendChild: (l: { id: string; rel: string; href: string }) => void links.push(l) },
    } as unknown as Document

    applyFont('IBM Plex Sans', fake)
    applyFont('IBM Plex Sans', fake) // deduplicated
    applyFont('Marianne', fake) // no fetch
    expect(vars.get('--font')).toContain("'Marianne'")
    expect(links).toHaveLength(1)
    expect(links[0]!.id).toBe(fontLinkId('IBM Plex Sans'))
    expect(() => applyFont('Anything', undefined)).not.toThrow()
  })

  /** A doc exposing exactly the Font Loading surface the probe touches. */
  const fontsDoc = (
    load: (probe: string) => Promise<unknown[]>,
    check: (probe: string) => boolean,
  ) => ({ fonts: { load, check } }) as unknown as Document

  it('probeFont: a face the load resolves is served', async () => {
    const doc = fontsDoc(
      async () => [{ family: 'Marianne' }],
      () => true,
    )
    await expect(probeFont('Marianne', doc)).resolves.toBe('served')
  })

  it('probeFont: an empty load answered by check() still counts as served', async () => {
    // Some engines resolve load() with [] yet render the face — check() is
    // the tie-breaker, asked only AFTER the forced load (before it, check
    // reports unloaded declared faces as unavailable).
    const doc = fontsDoc(
      async () => [],
      () => true,
    )
    await expect(probeFont('Marianne', doc)).resolves.toBe('served')
  })

  it('probeFont: nothing loads, check refuses — missing', async () => {
    const doc = fontsDoc(
      async () => [],
      () => false,
    )
    await expect(probeFont('Marianne', doc)).resolves.toBe('missing')
  })

  it('probeFont: a rejecting load degrades to missing, never a throw', async () => {
    const doc = fontsDoc(
      () => Promise.reject(new Error('network')),
      () => true,
    )
    await expect(probeFont('Marianne', doc)).resolves.toBe('missing')
  })

  it('probeFont: no document or no Font Loading API — unknown (no way to ask)', async () => {
    await expect(probeFont('Marianne', undefined)).resolves.toBe('unknown')
    await expect(probeFont('Marianne', {} as unknown as Document)).resolves.toBe('unknown')
  })

  it('probeFont: a blank family is missing by definition; quotes are stripped', async () => {
    const probes: string[] = []
    const doc = fontsDoc(
      async (probe) => {
        probes.push(probe)
        return []
      },
      () => false,
    )
    await expect(probeFont('   ', doc)).resolves.toBe('missing')
    await probeFont('"Marianne"', doc)
    expect(probes).toEqual(['16px "Marianne"'])
  })
})

/** One clean embedded face; `over` twists a field. */
const face = (over: Partial<EmbeddedFontFace> = {}): EmbeddedFontFace => ({
  family: 'Marianne',
  weight: '400',
  style: 'normal',
  dataUri: 'data:font/woff2;base64,d09GMgABAA==',
  ...over,
})

describe('embedded faces — CSS emission and precedence', () => {
  it('embeddedFontFaceCss: one @font-face per face, descriptors verbatim', () => {
    const css = embeddedFontFaceCss([face(), face({ weight: '500 600', style: 'italic' })])
    expect(css.split('\n')).toHaveLength(2)
    expect(css).toContain("font-family:'Marianne'")
    expect(css).toContain('font-weight:500 600')
    expect(css).toContain('font-style:italic')
    expect(css).toContain('font-display:swap')
    expect(css).toContain('url("data:font/woff2;base64,d09GMgABAA==") format(\'woff2\')')
  })

  it('embeddedFontFaceCss: total — a face failing the emission re-check is skipped', () => {
    // Belt to the parse's brace: these strings would break out of the CSS
    // contexts they land in, so they never reach the stylesheet.
    expect(embeddedFontFaceCss([face({ family: "X') } body { color: red" })])).toBe('')
    expect(embeddedFontFaceCss([face({ dataUri: 'data:font/woff2;base64,AA"A' })])).toBe('')
    expect(embeddedFontFaceCss([face({ weight: 'bold' })])).toBe('')
    expect(embeddedFontFaceCss([face({ style: 'oblique' as 'italic' })])).toBe('')
    expect(embeddedFontFaceCss(undefined)).toBe('')
  })

  it('embeddedFamilies: unique families of the emission-valid faces', () => {
    expect(embeddedFamilies([face(), face({ weight: '700' }), face({ family: 'Extra' })])).toEqual([
      'Marianne',
      'Extra',
    ])
    expect(embeddedFamilies([face({ family: '<bad>' })])).toEqual([])
    expect(embeddedFamilies(undefined)).toEqual([])
  })

  /** A fake document exposing exactly what applyEmbeddedFonts touches. */
  const styleDoc = () => {
    const styles: Array<{ id: string; textContent: string; remove: () => void }> = []
    const doc = {
      getElementById: (id: string) => styles.find((s) => s.id === id) ?? null,
      createElement: () => {
        const el = {
          id: '',
          textContent: '',
          remove: () => void styles.splice(styles.indexOf(el), 1),
        }
        return el
      },
      head: { appendChild: (el: (typeof styles)[number]) => void styles.push(el) },
    } as unknown as Document
    return { doc, styles }
  }

  it('applyEmbeddedFonts: installs once, replaces on change, removes when empty', () => {
    const { doc, styles } = styleDoc()
    applyEmbeddedFonts([face()], doc)
    expect(styles).toHaveLength(1)
    expect(styles[0]!.id).toBe(EMBEDDED_STYLE_ID)
    const first = styles[0]!.textContent
    applyEmbeddedFonts([face()], doc) // same faces — content untouched
    expect(styles[0]!.textContent).toBe(first)
    applyEmbeddedFonts([face({ weight: '700' })], doc) // replaced wholesale
    expect(styles).toHaveLength(1)
    expect(styles[0]!.textContent).toContain('font-weight:700')
    applyEmbeddedFonts(undefined, doc) // nothing embedded — the sheet leaves
    expect(styles).toHaveLength(0)
    applyEmbeddedFonts(undefined, doc) // idempotent on the empty state
    expect(styles).toHaveLength(0)
    expect(() => applyEmbeddedFonts([face()], undefined)).not.toThrow()
  })

  it('applyFont: an embedded family never fetches Google and evicts its stale link', () => {
    const links: Array<{ id: string; rel: string; href: string; remove: () => void }> = []
    const vars = new Map<string, string>()
    const fake = {
      documentElement: { style: { setProperty: (k: string, v: string) => void vars.set(k, v) } },
      getElementById: (id: string) => links.find((l) => l.id === id) ?? null,
      createElement: () => {
        const el = {
          id: '',
          rel: '',
          href: '',
          remove: () => void links.splice(links.indexOf(el), 1),
        }
        return el
      },
      head: { appendChild: (l: (typeof links)[number]) => void links.push(l) },
    } as unknown as Document

    // The family was a Google one first: a link exists…
    applyFont('Custom Face', fake)
    expect(links).toHaveLength(1)
    // …then the portfolio embeds it: the link is evicted, none re-injected.
    applyFont('Custom Face', fake, ['Custom Face'])
    expect(links).toHaveLength(0)
    expect(vars.get('--font')).toContain("'Custom Face'")
    // Covered from the start: never any link at all.
    applyFont('Other Face', fake, ['Other Face'])
    expect(links).toHaveLength(0)
  })
})

describe('asWoff2DataUri — the picked-file normalisation', () => {
  it('rewrites the browser-stamped MIME to the canonical woff2 prefix', () => {
    expect(asWoff2DataUri('data:application/octet-stream;base64,d09GMgABAA==')).toBe(
      'data:font/woff2;base64,d09GMgABAA==',
    )
    expect(asWoff2DataUri('data:font/woff2;base64,d09GMgABAA==')).toBe(
      'data:font/woff2;base64,d09GMgABAA==',
    )
  })

  it('refuses anything that is not a woff2 payload', () => {
    expect(asWoff2DataUri('data:font/woff2;base64,AAEAAAAK')).toBeNull() // TTF magic
    expect(asWoff2DataUri('data:font/woff2;base64,d09GRgAB')).toBeNull() // woff1 magic
    expect(asWoff2DataUri('data:text/plain,hello')).toBeNull() // not base64
    expect(asWoff2DataUri('no comma at all')).toBeNull()
    expect(asWoff2DataUri('data:font/woff2;base64,d09GMg!!')).toBeNull() // dirty charset
  })
})
