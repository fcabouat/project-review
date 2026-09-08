/**
 * « Enregistrer » — a STANDALONE .html of the slideshow alone: reveal.js
 * inlined, every stylesheet of the running document inlined, the rendered
 * sections copied as-is, the images embedded as data URIs. The file opens from
 * `file://` with zero network request (Google Fonts excepted, when the theme
 * asks for a family that is not bundled — Roboto, Inter and Marianne are).
 *
 * Two halves, deliberately separated:
 * - the PURE half (`buildStandaloneHtml`, `exportFileName`, `embedStyleAssets`)
 *   assembles strings from provided pieces — unit-tested under node, no DOM
 *   anywhere (the fetch of `embedStyleAssets` is injectable);
 * - the DOM half (`collectDocumentStyles`, `serializeSlides`, `inlineImages`,
 *   `saveStandalone`) harvests those pieces from the live document.
 *
 * `saveStandalone` is what the app injects into the components' SlideshowHost
 * (`exportStandalone` prop), reveal options included: the option set lives in
 * `@project-review/components/slideshow/reveal-options`, and this package
 * never imports components — the app hands the options over at the seam.
 */

import type { Portfolio } from '@project-review/core/model/portfolio'
import { fontStack, googleFontsUrl } from './fonts'

/* ------------------------------- pure half ------------------------------ */

export interface StandaloneParts {
  /** `<html lang>` — the review's language. */
  readonly lang: string
  /** `data-slide-style` on `<html>` — the theme CSS keys off this attribute. */
  readonly slideStyle?: string
  /** `data-palette` on `<html>` — freezes the category colors (`palettes.css`)
   * into the exported file, whatever palette the live app later switches to. */
  readonly palette?: string
  /** `<title>` — the review's title. */
  readonly title: string
  /** All CSS, reveal's base sheet first, then the application's sheets. */
  readonly styles: string
  /**
   * Font family stored in the portfolio (`settings.theme.font`). The live
   * app applies it as an INLINE `--font` on `<html>` (`applyFont`), which no
   * stylesheet collection can see — the builder therefore re-emits the rule
   * itself, last, so the exported deck keeps the chosen font.
   */
  readonly fontFamily?: string
  /** innerHTML of the rendered `.slides` container (sections and stacks). */
  readonly slidesHtml: string
  /** The reveal.js UMD source (exposes `window.Reveal`). */
  readonly revealSource: string
  /** Reveal option set the standalone deck boots with, serialised verbatim —
   * the caller passes the components' `STANDALONE_REVEAL_OPTIONS`. */
  readonly revealOptions: Record<string, unknown>
  /** Google Fonts stylesheet URL, or null for the bundled families. */
  readonly fontHref?: string | null
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * A literal `</script>` inside an inlined source would close our `<script>`
 * element mid-file; `<\/script>` is byte-identical to the parser of the
 * embedded JS (`\/` is `/` in strings and regexes) and invisible to HTML.
 */
function escapeScriptClose(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script')
}

/**
 * Download name of the standalone file. The review date (already `YYYY-MM-DD`,
 * filesystem-safe and sortable) is the natural version stamp — successive
 * reviews saved to one folder line up chronologically instead of overwriting
 * each other. `undefined` is tolerated for robustness; a parsed portfolio
 * always has a review date.
 */
export function exportFileName(reviewDate: string | undefined): string {
  return reviewDate ? `slideshow-${reviewDate}.html` : 'slideshow.html'
}

/**
 * The whole file, from pieces the caller harvested. The markup mirrors the
 * live host — `.rp-stage > .reveal > .slides` — so every rule scoped to
 * `.rp-stage` in `slideshow.css` applies identically from `file://`.
 */
export function buildStandaloneHtml(parts: StandaloneParts): string {
  const fontLink =
    parts.fontHref == null ? '' : `<link rel="stylesheet" href="${escapeHtml(parts.fontHref)}">\n`
  const styleAttr =
    parts.slideStyle === undefined ? '' : ` data-slide-style="${escapeHtml(parts.slideStyle)}"`
  const paletteAttr =
    parts.palette === undefined ? '' : ` data-palette="${escapeHtml(parts.palette)}"`
  return `<!doctype html>
<html lang="${escapeHtml(parts.lang)}"${styleAttr}${paletteAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(parts.title)}</title>
${fontLink}<style>
${parts.styles}
/* Chosen font — emitted LAST so it wins over the collected theme defaults. */
:root{--font:${fontStack(parts.fontFamily ?? '')}}
</style>
</head>
<body>
<div class="rp-stage"><div class="reveal"><div class="slides">
${parts.slidesHtml}
</div></div></div>
<script>
${escapeScriptClose(parts.revealSource)}
</script>
<script>
new window.Reveal(document.querySelector('.reveal'), ${JSON.stringify(parts.revealOptions)}).initialize().then(function () {
  // Same fix as the live host: the inlined Tailwind preflight hides [hidden]
  // with !important, while reveal drives non-present sections through inline
  // styles. reveal keeps aria-hidden; the boolean attribute must go.
  var slides = document.querySelector('.reveal .slides');
  var strip = function () {
    slides.querySelectorAll('section[hidden]').forEach(function (s) { s.removeAttribute('hidden'); });
  };
  strip();
  new MutationObserver(strip).observe(slides, { attributes: true, attributeFilter: ['hidden'], subtree: true });
});
</script>
</body>
</html>
`
}

/** Resolves a URL to a `data:` URI, or `null` when unreachable — injectable. */
export type UriFetcher = (url: string) => Promise<string | null>

/** Matches `url(...)` in CSS text, quoted or not; group 2 is the target. */
const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g

/** `@font-face` bodies never nest braces: the lazy block match is exact. */
const FONT_FACE_RULE = /@font-face\s*\{[^}]*\}/g

/** Already inline, or an intra-document SVG reference: nothing to fetch. */
const isExternal = (url: string): boolean => !url.startsWith('data:') && !url.startsWith('#')

/**
 * Embeds every external `url()` of the collected CSS as a `data:` URI — the
 * browser serialises them as ABSOLUTE URLs of the origin, which from `file://`
 * means a network request (or a silently missing font). Same totality contract
 * as `inlineImages`, with one asymmetry: an `@font-face` whose source cannot be
 * fetched is DROPPED WHOLE (the system fallback of the stack takes over — a
 * face pointing at an unreachable server would be worse than no face), while
 * any other unreachable asset keeps its URL rather than losing the rule.
 *
 * Pure half despite living next to the DOM harvesters: the fetch is injected,
 * so the function is plain string → string under test.
 */
export async function embedStyleAssets(
  css: string,
  fetchUri: UriFetcher = fetchAsDataUri,
): Promise<string> {
  const targets = new Set<string>()
  for (const m of css.matchAll(CSS_URL)) {
    const url = m[2]!
    if (isExternal(url)) targets.add(url)
  }
  const resolved = new Map<string, string | null>()
  await Promise.all([...targets].map(async (url) => resolved.set(url, await fetchUri(url))))

  const kept = css.replace(FONT_FACE_RULE, (rule) => {
    const unreachable = [...rule.matchAll(CSS_URL)].some(
      (m) => isExternal(m[2]!) && resolved.get(m[2]!) == null,
    )
    return unreachable ? '' : rule
  })
  return kept.replace(CSS_URL, (whole, _quote: string, url: string) => {
    const dataUri = resolved.get(url)
    return dataUri == null ? whole : `url("${dataUri}")`
  })
}

/* ------------------------------- DOM half ------------------------------- */
/* v8 ignore start -- live-document harvesters (fetch, FileReader, styleSheets,
   cloneNode): exercised by SlideshowHost in the browser, out of the node
   coverage perimeter by design (see the module header). */

/** `fetch` + `FileReader` — the one mechanic for images and style assets. */
const fetchAsDataUri: UriFetcher = async (url) => {
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('unreadable blob'))
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Every rule of every stylesheet of the document — Svelte component styles,
 * `slideshow.css`, the theme — EXCEPT the reveal base sheet the host injected
 * (`data-owner="slideshow"`): the caller prepends the same text itself, once.
 * Cross-origin sheets (Google Fonts) throw on `cssRules` and are skipped: the
 * font comes back through the `<link>` of the pure half.
 *
 * The collected text still points at the origin (`url()` serialises absolute):
 * the caller passes it through `embedStyleAssets` before building the file.
 */
export function collectDocumentStyles(doc: Document): string {
  const chunks: string[] = []
  for (const sheet of Array.from(doc.styleSheets)) {
    const owner = sheet.ownerNode
    if (owner instanceof HTMLElement && owner.dataset['owner'] === 'slideshow') continue
    try {
      for (const rule of Array.from(sheet.cssRules)) chunks.push(rule.cssText)
    } catch {
      // Cross-origin stylesheet — unreadable, relinked instead of inlined.
    }
  }
  return chunks.join('\n')
}

/**
 * A cleaned clone of the rendered `.slides` container: reveal's runtime
 * decorations (inline display/transform, hidden/aria-hidden, past/present/future)
 * are stripped so the standalone deck boots from a virgin state — its own
 * `initialize()` reapplies all of them.
 */
export function serializeSlides(slidesEl: HTMLElement): HTMLElement {
  const clone = slidesEl.cloneNode(true) as HTMLElement
  for (const section of Array.from(clone.querySelectorAll('section'))) {
    section.removeAttribute('style')
    section.removeAttribute('hidden')
    section.removeAttribute('aria-hidden')
    section.removeAttribute('data-index-h')
    section.removeAttribute('data-index-v')
    section.classList.remove('present', 'past', 'future')
    if (section.classList.length === 0) section.removeAttribute('class')
  }
  return clone
}

/**
 * Every `<img>` not already a data URI is fetched and embedded, so the logos
 * survive `file://`. Total: an image that cannot be fetched keeps its src.
 */
export async function inlineImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src')
      if (src === null || src === '' || src.startsWith('data:')) return
      const dataUri = await fetchAsDataUri(src)
      // Unreachable image: left as-is rather than losing the element.
      if (dataUri !== null) img.setAttribute('src', dataUri)
    }),
  )
}

/**
 * The whole « Enregistrer » flow. The app injects it into the components'
 * SlideshowHost with the reveal options bound:
 * `(el, p) => saveStandalone(el, p, STANDALONE_REVEAL_OPTIONS)`.
 * The engine SOURCE (`?raw`, UMD build) and the base stylesheet are dynamic
 * chunks like the engine itself — nothing of the export weighs on the
 * editor's bundle.
 */
export async function saveStandalone(
  slidesEl: HTMLElement,
  portfolio: Portfolio,
  revealOptions: Record<string, unknown>,
): Promise<void> {
  // Relative path on purpose: the package's `exports` map does not expose
  // `./dist/reveal.js` (the UMD build), only the entry points — a direct
  // file import is the supported Vite escape hatch for `?raw`.
  const [engineSource, base] = await Promise.all([
    import('../../../node_modules/reveal.js/dist/reveal.js?raw'),
    import('reveal.js/reveal.css?inline'),
  ])
  const clone = serializeSlides(slidesEl)
  // Zero real network from file://: images AND style assets (bundled
  // @font-face woff2, background images) become data URIs.
  const [styles] = await Promise.all([
    embedStyleAssets(collectDocumentStyles(document)),
    inlineImages(clone),
  ])
  const html = buildStandaloneHtml({
    lang: portfolio.settings.language,
    slideStyle: portfolio.settings.theme.style,
    palette: portfolio.settings.theme.palette,
    title: portfolio.review.title,
    styles: `${base.default}\n${styles}`,
    fontFamily: portfolio.settings.theme.font,
    slidesHtml: clone.innerHTML,
    revealSource: engineSource.default,
    revealOptions,
    fontHref: googleFontsUrl(portfolio.settings.theme.font),
  })

  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = exportFileName(portfolio.review.reviewDate)
  anchor.click()
  URL.revokeObjectURL(url)
}
/* v8 ignore stop */
