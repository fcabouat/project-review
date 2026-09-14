/**
 * Pins the font service (`src/fonts.ts`) — safe stack building, the embedded
 * `@font-face` sheet, and the promise the whole module rests on: applying a
 * font touches the document and NOTHING else, whatever family is asked for.
 */
import { describe, expect, it } from 'vitest'
import type { EmbeddedFontFace } from '@project-review/core/model/theme'
import {
  BUNDLED_FAMILIES,
  DEPLOYED_STYLE_ID,
  EMBEDDED_STYLE_ID,
  applyDeployedFont,
  applyEmbeddedFonts,
  applyFont,
  asWoff2DataUri,
  deployedFontFaceCss,
  embeddedFamilies,
  embeddedFontFaceCss,
  fontStack,
  probeFont,
} from '../src/fonts'

describe('font service', () => {
  it('fontStack: Roboto (default) and empty fall back, others are prepended quoted', () => {
    expect(fontStack('Roboto')).toBe("'Roboto', 'Inter', 'Segoe UI', system-ui, sans-serif")
    expect(fontStack('  ')).toBe("'Roboto', 'Inter', 'Segoe UI', system-ui, sans-serif")
    expect(fontStack('Inter')).toBe("'Inter', 'Roboto', 'Segoe UI', system-ui, sans-serif")
    expect(fontStack('Atelier')).toBe(
      "'Atelier', 'Roboto', 'Inter', 'Segoe UI', system-ui, sans-serif",
    )
    expect(fontStack('IBM Plex Sans')).toContain("'IBM Plex Sans', 'Roboto'")
    expect(fontStack('O\'Weird"Name')).toContain("'OWeirdName'") // quotes stripped, never injected
  })

  it('BUNDLED_FAMILIES: exactly the woff2 this build carries', () => {
    // @fontsource/roboto and @fontsource/inter, imported by the app's main.ts.
    // Atelier is NOT here: it is deployed alongside, not bundled.
    expect(BUNDLED_FAMILIES).toStrictEqual(['Roboto', 'Inter'])
  })

  /**
   * THE PROMISE: a font never reaches for the network. Whatever family the
   * portfolio names — bundled, deployed, embedded or entirely unknown —
   * applying it sets one CSS variable and creates NO element: no `<link>`, no
   * request, no third party told who is reading. The fake document below
   * records every element the function would create.
   */
  it('applyFont: sets the variable and creates nothing, for any family', () => {
    const created: string[] = []
    const appended: unknown[] = []
    const vars = new Map<string, string>()
    const fake = {
      documentElement: { style: { setProperty: (k: string, v: string) => void vars.set(k, v) } },
      getElementById: () => null,
      createElement: (tag: string) => {
        created.push(tag)
        return { id: '', rel: '', href: '' }
      },
      head: { appendChild: (l: unknown) => void appended.push(l) },
    } as unknown as Document

    for (const family of ['IBM Plex Sans', 'Atelier', 'Roboto', 'Totally Unknown']) {
      applyFont(family, fake)
    }

    expect(vars.get('--font')).toContain("'Totally Unknown'")
    expect(created).toStrictEqual([])
    expect(appended).toStrictEqual([])
    expect(() => applyFont('Anything', undefined)).not.toThrow()
  })

  /** A doc exposing exactly the Font Loading surface the probe touches. */
  const fontsDoc = (
    load: (probe: string) => Promise<unknown[]>,
    check: (probe: string) => boolean,
  ) => ({ fonts: { load, check } }) as unknown as Document

  it('probeFont: a face the load resolves is served', async () => {
    const doc = fontsDoc(
      async () => [{ family: 'Atelier' }],
      () => true,
    )
    await expect(probeFont('Atelier', doc)).resolves.toBe('served')
  })

  it('probeFont: an empty load is missing even when check() claims a fallback', async () => {
    const doc = fontsDoc(
      async () => [],
      () => true,
    )
    await expect(probeFont('Atelier', doc)).resolves.toBe('missing')
  })

  it('probeFont: nothing loads, check refuses — missing', async () => {
    const doc = fontsDoc(
      async () => [],
      () => false,
    )
    await expect(probeFont('Atelier', doc)).resolves.toBe('missing')
  })

  it('probeFont: a rejecting load degrades to missing, never a throw', async () => {
    const doc = fontsDoc(
      () => Promise.reject(new Error('network')),
      () => true,
    )
    await expect(probeFont('Atelier', doc)).resolves.toBe('missing')
  })

  it('probeFont: no document or no Font Loading API — unknown (no way to ask)', async () => {
    await expect(probeFont('Atelier', undefined)).resolves.toBe('unknown')
    await expect(probeFont('Atelier', {} as unknown as Document)).resolves.toBe('unknown')
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
    await probeFont('"Atelier"', doc)
    expect(probes).toEqual(['16px "Atelier"'])
  })
})

/** One clean embedded face; `over` twists a field. */
const face = (over: Partial<EmbeddedFontFace> = {}): EmbeddedFontFace => ({
  family: 'Atelier',
  weight: '400',
  style: 'normal',
  dataUri: 'data:font/woff2;base64,d09GMgABAA==',
  ...over,
})

describe('embedded faces — CSS emission and precedence', () => {
  it('embeddedFontFaceCss: one @font-face per face, descriptors verbatim', () => {
    const css = embeddedFontFaceCss([face(), face({ weight: '500 600', style: 'italic' })])
    expect(css.split('\n')).toHaveLength(2)
    expect(css).toContain("font-family:'Atelier'")
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
      'Atelier',
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

  /**
   * The deployment convention, and the fact that makes it GENERIC: the rules
   * are built from the family the portfolio names — no family is written into
   * the product, and none is privileged.
   */
  it('deployedFontFaceCss: three faces, built from whatever family is asked', () => {
    const css = deployedFontFaceCss('Atelier')
    expect(css.split('\n')).toHaveLength(3)
    expect(css).toContain("font-family:'Atelier'")
    expect(css).toContain('url("fonts/Atelier/Atelier-Regular.woff2")')
    expect(css).toContain('font-weight:500 600')
    expect(css).toContain('url("fonts/Atelier/Atelier-Bold.woff2")')
    // RELATIVE urls: the same build works at a root, under a sub-path, or
    // from a folder — and never points outside its own deployment.
    expect(css).not.toContain('url("/')
    expect(css).not.toContain('//')
  })

  it('deployedFontFaceCss: a family with spaces is percent-encoded in the path', () => {
    const css = deployedFontFaceCss('Atelier Sans')
    expect(css).toContain("font-family:'Atelier Sans'")
    expect(css).toContain('url("fonts/Atelier%20Sans/Atelier%20Sans-Regular.woff2")')
  })

  it('deployedFontFaceCss: nothing for a bundled family or a name off the charset', () => {
    // Bundled faces are already in the build: pointing at a deployment that
    // has no such folder would only add failed requests.
    expect(deployedFontFaceCss('Roboto')).toBe('')
    expect(deployedFontFaceCss('Inter')).toBe('')
    expect(deployedFontFaceCss('   ')).toBe('')
    expect(deployedFontFaceCss("X') } body { color: red")).toBe('')
  })

  it('applyDeployedFont: installs once, replaces on change, removes when there is nothing', () => {
    const { doc, styles } = styleDoc()

    applyDeployedFont('Atelier', doc)
    expect(styles).toHaveLength(1)
    expect(styles[0]!.id).toBe(DEPLOYED_STYLE_ID)
    expect(styles[0]!.textContent).toContain('fonts/Atelier/')

    applyDeployedFont('Atelier', doc) // idempotent on the same family
    expect(styles).toHaveLength(1)

    applyDeployedFont('Other', doc) // replaced wholesale
    expect(styles).toHaveLength(1)
    expect(styles[0]!.textContent).toContain('fonts/Other/')

    applyDeployedFont('Roboto', doc) // bundled — the sheet leaves
    expect(styles).toHaveLength(0)
    applyDeployedFont('Roboto', doc) // idempotent on the empty state
    expect(styles).toHaveLength(0)
    expect(() => applyDeployedFont('Atelier', undefined)).not.toThrow()
  })

  it('applyDeployedFont: a family the PORTFOLIO embeds declares nothing', () => {
    const { doc, styles } = styleDoc()
    // The data URIs are already the strongest source; asking the deployment
    // for files it may not have would only add failed requests.
    applyDeployedFont('Atelier', doc, ['Atelier'])
    expect(styles).toHaveLength(0)
    applyDeployedFont('  "Atelier"  ', doc, ['Atelier'])
    expect(styles).toHaveLength(0)
  })

  it('an embedded family is served by its own sheet, and named in the stack', () => {
    const styles: Array<{ id: string; textContent: string }> = []
    const vars = new Map<string, string>()
    const doc = {
      documentElement: { style: { setProperty: (k: string, v: string) => void vars.set(k, v) } },
      getElementById: (id: string) => styles.find((s) => s.id === id) ?? null,
      createElement: () => ({ id: '', textContent: '' }),
      head: { appendChild: (s: (typeof styles)[number]) => void styles.push(s) },
    } as unknown as Document

    const embedded = [face({ family: 'Custom Face' })]
    applyEmbeddedFonts(embedded, doc)
    applyFont('Custom Face', doc)

    expect(embeddedFamilies(embedded)).toStrictEqual(['Custom Face'])
    expect(styles[0]!.textContent).toContain("font-family:'Custom Face'")
    expect(vars.get('--font')).toContain("'Custom Face'")
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

  it('checks decoded magic bytes, including the valid d09GMk base64 spelling', () => {
    expect(asWoff2DataUri('data:font/woff2;base64,d09GMkABAA==')).toBe(
      'data:font/woff2;base64,d09GMkABAA==',
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
