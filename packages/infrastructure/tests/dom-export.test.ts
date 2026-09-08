/**
 * Pins the pure half of the standalone export (`src/dom-export.ts`) — string
 * assembly only, no DOM: the harvested pieces are stubbed
 * (`fixtures/standalone-export-stubs.ts`) and the resulting file is inspected
 * as text. The real reveal option set is the components' business (injected
 * at the seam by the app); here a stub proves it is serialised verbatim.
 */
import { describe, expect, it } from 'vitest'
import { buildStandaloneHtml, embedStyleAssets, exportFileName } from '../src/dom-export'
import { fontStack } from '../src/fonts'
import { CSS, REVEAL_OPTIONS, fetcherOf, parts } from './fixtures/standalone-export-stubs'

describe('buildStandaloneHtml', () => {
  const html = buildStandaloneHtml(parts)

  it('is a complete document: doctype, lang, charset, title', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="fr">')
    expect(html).toContain('<meta charset="utf-8">')
    expect(html).toContain('<title>Revue des projets</title>')
  })

  it('inlines the styles and the reveal source', () => {
    expect(html).toContain('.reveal{color:red}')
    expect(html).toContain('window.Reveal = function () {};')
  })

  it('keeps the host structure so the .rp-stage-scoped rules apply', () => {
    expect(html).toContain('<div class="rp-stage"><div class="reveal"><div class="slides">')
    expect(html).toContain(parts.slidesHtml)
  })

  it('boots reveal with the injected options, serialised verbatim', () => {
    expect(html).toContain(
      `new window.Reveal(document.querySelector('.reveal'), ${JSON.stringify(REVEAL_OPTIONS)}).initialize()`,
    )
  })

  it('re-emits the chosen font as a :root rule, AFTER the collected styles', () => {
    // The live app sets --font as an inline style on <html> (applyFont), which
    // the stylesheet collection cannot see: without this rule the export
    // silently loses the chosen font.
    const withFont = buildStandaloneHtml({ ...parts, fontFamily: 'Georgia' })
    expect(withFont).toContain(`:root{--font:${fontStack('Georgia')}}`)
    expect(withFont).toContain(":root{--font:'Georgia',")
    expect(withFont.indexOf(':root{--font:')).toBeGreaterThan(withFont.indexOf(parts.styles))

    // No family given: the rule still lands, on the bundled default stack.
    expect(html).toContain(`:root{--font:${fontStack('')}}`)
  })

  it('no font link for the bundled families, one for a Google family', () => {
    expect(html).not.toContain('fonts.googleapis.com')
    const withFont = buildStandaloneHtml({
      ...parts,
      fontHref: 'https://fonts.googleapis.com/css2?family=Roboto',
    })
    expect(withFont).toContain(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto">',
    )
  })

  it('escapes the title and neutralises </script> inside the inlined source', () => {
    const tricky = buildStandaloneHtml({
      ...parts,
      title: 'A <b>& "B"',
      revealSource: 'const s = "</script><script>alert(1)"',
    })
    expect(tricky).toContain('<title>A &lt;b&gt;&amp; &quot;B&quot;</title>')
    expect(tricky).not.toContain('const s = "</script>')
    expect(tricky).toContain('const s = "<\\/script>')
  })
})

describe('embedStyleAssets', () => {
  it('embeds every reachable url() as a data URI (fonts and images alike)', async () => {
    const { fetchUri } = fetcherOf({
      'http://localhost/inter.woff2': 'data:font/woff2;base64,V09GRg==',
      'http://localhost/logo.svg': 'data:image/svg+xml;base64,PHN2Zz4=',
      'http://localhost/ghost.woff2': 'data:font/woff2;base64,Rw==',
      'http://localhost/gone.png': 'data:image/png;base64,Rw==',
    })
    const out = await embedStyleAssets(CSS, fetchUri)
    expect(out).toContain('src:url("data:font/woff2;base64,V09GRg==")')
    expect(out).toContain('background-image:url("data:image/svg+xml;base64,PHN2Zz4=")')
    expect(out).not.toContain('http://localhost')
  })

  it('drops a whole @font-face whose source is unreachable, keeps other rules', async () => {
    const { fetchUri } = fetcherOf({
      'http://localhost/inter.woff2': 'data:font/woff2;base64,V09GRg==',
      'http://localhost/logo.svg': 'data:image/svg+xml;base64,PHN2Zz4=',
      // ghost.woff2 and gone.png unreachable
    })
    const out = await embedStyleAssets(CSS, fetchUri)
    // The reachable face survives, embedded; the unreachable one vanishes
    // entirely (a face pointing at the origin would hit the network or fail).
    expect(out).toContain('font-family:Inter')
    expect(out).not.toContain('Ghost')
    // A non-font asset that cannot be fetched keeps its URL — rule preserved.
    expect(out).toContain(".gone{background-image:url('http://localhost/gone.png')}")
  })

  it('leaves data: URIs and intra-document references alone, without fetching them', async () => {
    const { fetchUri, asked } = fetcherOf({})
    const out = await embedStyleAssets(
      '.inline{background:url(data:image/png;base64,AAA)}\n.ref{fill:url(#gradient)}',
      fetchUri,
    )
    expect(out).toContain('url(data:image/png;base64,AAA)')
    expect(out).toContain('url(#gradient)')
    expect(asked).toEqual([])
  })

  it('fetches each distinct URL once, however many rules use it', async () => {
    const { fetchUri, asked } = fetcherOf({
      'http://localhost/x.png': 'data:image/png;base64,eA==',
    })
    const out = await embedStyleAssets(
      '.a{background:url(http://localhost/x.png)}.b{background:url("http://localhost/x.png")}',
      fetchUri,
    )
    expect(asked).toEqual(['http://localhost/x.png'])
    expect(out).not.toContain('http://localhost')
  })
})

describe('exportFileName', () => {
  it('carries the review date, falls back without one', () => {
    expect(exportFileName('2026-09-03')).toBe('slideshow-2026-09-03.html')
    expect(exportFileName(undefined)).toBe('slideshow.html')
  })
})

describe('theme stamp', () => {
  it('carries data-slide-style and data-palette on <html> when provided', () => {
    const html = buildStandaloneHtml({
      lang: 'fr',
      slideStyle: 'flat',
      palette: 'dsfr',
      title: 'T',
      styles: '',
      slidesHtml: '<section></section>',
      revealSource: '',
      revealOptions: REVEAL_OPTIONS,
    })
    // The frozen palette keeps the exported deck's category colors whatever
    // the live app later switches to (palettes.css scopes on this attribute).
    expect(html).toContain('<html lang="fr" data-slide-style="flat" data-palette="dsfr">')
  })

  it('omits both attributes when absent', () => {
    const html = buildStandaloneHtml({
      lang: 'en',
      title: 'T',
      styles: '',
      slidesHtml: '<section></section>',
      revealSource: '',
      revealOptions: REVEAL_OPTIONS,
    })
    expect(html).toContain('<html lang="en">')
  })
})
