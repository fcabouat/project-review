/**
 * THE STAGING BEHIND `docs/images/{en,fr}-embedded-font.png`, AND THE CAPTURE
 * THAT REMAKES THEM.
 *
 * Those two screenshots show the Appearance card's portfolio-identity half
 * with all three carried assets present at once: the portfolio's own twelve
 * colours heading the palette list, two embedded font faces with their weight
 * and size, and a logo. No sample set carries any of that, no story stages the
 * three together, and nothing in the repository could produce the screen — so
 * the images could go stale against the interface they document, in silence
 * and with no way for anyone to tell. This script IS that missing staging: the
 * portfolio below is the one the pictures show.
 *
 * NOT A GATE, and deliberately not one: a pixel comparison of a screenshot is
 * a check that fails on a font hint. What is versioned here is the ability to
 * REMAKE the pictures deliberately, when the card changes.
 *
 *   bun run build                          # the deliverable the capture drives
 *   node scripts/stage-doc-images.mjs [outDir] [face.woff2]
 *
 * `outDir` defaults to `docs/images` — the two committed files — so a rerun
 * replaces them; pass a scratch directory to look first.
 *
 * PASS A REAL FACE WHEN REMAKING THE COMMITTED IMAGES. Without one the staging
 * falls back to the repository's own 480-byte test face
 * (`app/tests-smoke/fixtures/TestFace-Regular.woff2`), which carries almost no
 * glyph: the card is laid out correctly and the statuses are real, but the
 * family name renders as tofu and the sizes read « ~1 Ko ». That is enough to
 * see that the staging still works, and NOT enough to publish. No type family
 * is committed here — none of their licences would allow it — so the second
 * argument is where a licensed `.woff2` goes in.
 *
 * Everything else — the twelve-colour house palette, the logo, the live « font
 * embedded in the portfolio » verdict, the two weights — is the real thing.
 */
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const OUT = resolve(ROOT, process.argv[2] ?? 'docs/images')
const FALLBACK_FACE = join(ROOT, 'app/tests-smoke/fixtures/TestFace-Regular.woff2')
const FACE = process.argv[3] === undefined ? FALLBACK_FACE : resolve(process.argv[3])

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.json': 'application/json',
}

/** The house palette of the pictures: the twelve domain colours, restated by
 * the portfolio itself so the list is headed by « Couleurs maison ». */
const HOUSE_COLORS = {
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
}

/** A small square mark, inline — the logo the card shows. */
const LOGO =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#3460d8"/><path d="M18 44V20h12a8 8 0 0 1 0 16h-6v8z" fill="#fff"/></svg>`,
  ).toString('base64')

const LABEL = { fr: 'Couleurs maison', en: 'House colours' }
const HEADING = { fr: 'Identité du portefeuille', en: 'Portfolio identity' }

/** The staged portfolio: content kept to the minimum, the three carried assets
 * at full strength — they are the subject. */
const staging = (language, faceUri) => ({
  version: 3,
  review: {
    title: language === 'fr' ? 'Revue des projets' : 'Project review',
    reviewDate: '2026-03-03',
  },
  settings: {
    language,
    identity: {
      org: 'Projay Inc.',
      unit: language === 'fr' ? 'Direction des systèmes' : 'Systems division',
      logo: LOGO,
    },
    theme: {
      style: 'flat',
      palette: 'material',
      font: 'Atelier',
      fontFaces: [
        { family: 'Atelier', weight: '400', style: 'normal', dataUri: faceUri },
        { family: 'Atelier', weight: '700', style: 'normal', dataUri: faceUri },
      ],
      customPalette: { label: LABEL[language], colors: HOUSE_COLORS },
    },
    show: { healthDashboard: true, recap: true, archives: true, decisions: true },
    recapRows: 11,
  },
  categories: [],
  projects: [],
  freeSlides: [],
})

/** Static file server over the repo root — the same one the smoke runs use. */
function serve(root) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0])
    const file = join(root, path)
    readFile(file)
      .then((body) => {
        res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
        res.end(body)
      })
      .catch(() => {
        res.writeHead(404)
        res.end()
      })
  })
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)))
}

/**
 * The half of the card the pictures frame: from the « Portfolio identity »
 * heading down to the licence line that closes the section. Computed from the
 * live DOM rather than hard-coded, so the crop follows the card.
 */
async function identityBox(page, heading) {
  return page.evaluate((text) => {
    const h3 = [...document.querySelectorAll('h3')].find((el) => el.textContent?.trim() === text)
    if (!h3) return null
    const section = h3.closest('section')
    if (!section) return null
    const last = section.querySelector(':scope > p:last-of-type')
    if (!last) return null
    const top = h3.getBoundingClientRect()
    const bottom = last.getBoundingClientRect()
    const frame = section.getBoundingClientRect()
    return {
      x: Math.round(frame.x),
      y: Math.round(top.y),
      width: Math.round(frame.width),
      height: Math.round(bottom.bottom - top.y),
    }
  }, heading)
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('Missing dist/index.html — run `bun run build` first.')
    process.exit(1)
  }
  const faceUri = `data:font/woff2;base64,${(await readFile(FACE)).toString('base64')}`
  if (FACE === FALLBACK_FACE) {
    console.log('no face given — using the 480-byte test face: the family will render as tofu')
  }
  await mkdir(OUT, { recursive: true })

  const server = await serve(ROOT)
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ chromiumSandbox: false })
  try {
    for (const language of ['en', 'fr']) {
      const context = await browser.newContext({
        locale: language === 'fr' ? 'fr-FR' : 'en-GB',
        viewport: { width: 1280, height: 1400 },
        deviceScaleFactor: 2,
      })
      // The staged document goes in as a stored envelope, which is how the app
      // boots into a portfolio without anyone clicking through an import.
      await context.addInitScript(
        (raw) => localStorage.setItem('project-review/state', raw),
        JSON.stringify({
          format: 1,
          revision: 1,
          portfolio: staging(language, faceUri),
          history: { past: [], future: [] },
        }),
      )
      const page = await context.newPage()
      await page.goto(`${base}/dist/index.html#/settings`)
      await page.waitForSelector('.editor')
      await page.waitForTimeout(600)

      const clip = await identityBox(page, HEADING[language])
      if (clip === null) {
        console.error(`${language}: the portfolio-identity heading was not found — card changed?`)
        process.exit(1)
      }
      const file = join(OUT, `${language}-embedded-font.png`)
      await page.screenshot({ path: file, clip })
      console.log(`${file} — ${clip.width}x${clip.height} css px`)
      await context.close()
    }
  } finally {
    await browser.close()
    server.close()
  }
}

await main()
