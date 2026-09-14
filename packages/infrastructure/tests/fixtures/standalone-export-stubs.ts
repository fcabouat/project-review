/**
 * WHY THIS FIXTURE. Stubbed harvest for the standalone-export tests: the real
 * pieces (styles, slides markup, reveal source) come from the live DOM, which
 * the pure assembly half never touches — so tiny recognisable strings stand
 * in, each findable verbatim in the produced file. The CSS table covers the
 * four url() situations `embedStyleAssets` must tell apart: a reachable font,
 * an unreachable font (the whole @font-face must vanish), reachable and
 * unreachable images (the rule survives either way), a data: URI and an
 * intra-document reference (both left alone).
 */

import type { UriFetcher } from '../../src/dom-export'

export const REVEAL_OPTIONS = { controls: true, hash: false, center: false } as const

/** Fixed nonce: the tests assert WHERE it lands (CSP meta, both scripts);
 * freshness is `generateNonce`'s own test. */
export const NONCE = 'TESTNONCE+bytes/16='

export const parts = {
  lang: 'fr',
  title: 'Revue des projets',
  styles: '.reveal{color:red}',
  slidesHtml:
    '<section class="slide">S1</section><section class="stack"><section class="slide">S2</section></section>',
  revealSource: 'window.Reveal = function () {};',
  revealOptions: REVEAL_OPTIONS,
  nonce: NONCE,
} as const

/** Fetcher double: answers from a table, records what it was asked. */
export const fetcherOf = (table: Record<string, string | null>) => {
  const asked: string[] = []
  const fetchUri: UriFetcher = (url) => {
    asked.push(url)
    return Promise.resolve(table[url] ?? null)
  }
  return { fetchUri, asked }
}

export const CSS = [
  "@font-face{font-family:Inter;src:url(http://localhost/inter.woff2) format('woff2')}",
  '@font-face{font-family:Ghost;src:url("http://localhost/ghost.woff2")}',
  '.logo{background-image:url(http://localhost/logo.svg)}',
  ".gone{background-image:url('http://localhost/gone.png')}",
  '.inline{background:url(data:image/png;base64,AAA)}',
  '.ref{fill:url(#gradient)}',
].join('\n')
