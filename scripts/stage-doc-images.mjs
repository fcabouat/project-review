/**
 * THE FOURTEEN PICTURES OF `docs/images/`, AND THE CAPTURE THAT REMAKES THEM.
 *
 * The two guides and the README show fourteen screenshots — seven surfaces,
 * English and French. Twelve of them used to be taken by hand, one window at a
 * time, and went stale twice without anyone noticing: nothing in the
 * repository said what they were supposed to show, so nothing could tell that
 * they no longer showed it. This script is that missing statement. ONE entry
 * point, fourteen files, every framing decided here rather than by whoever
 * happened to hold the mouse:
 *
 *   {en,fr}-review.png         #/review on the sample set
 *   {en,fr}-projects.png       #/projects — the portfolio grouped by category
 *   {en,fr}-sheet.png          #/sheet/P-01 — the Frame & status tab
 *   {en,fr}-settings.png       #/settings — identity, appearance, categories
 *   {en,fr}-import-merge.png   the import dialog, merge mode, counted preview
 *   {en,fr}-slide.png          the slideshow, opened on the P-01 sheet slide
 *   {en,fr}-embedded-font.png  Appearance ▸ Portfolio identity, all three
 *                              carried assets present at once
 *
 * USAGE — the deliverable first, the pictures second:
 *
 *   pnpm run build
 *   node scripts/stage-doc-images.mjs [outDir] [face.woff2]
 *
 * `outDir` defaults to `docs/images` — the fourteen committed files — so a
 * rerun replaces them; pass a scratch directory to look first. `face.woff2`
 * overrides the embedded type (below); the default needs no argument.
 *
 * NOT A GATE, and deliberately not one: a pixel comparison of a screenshot is
 * a check that fails on a font hint. What is versioned here is the ability to
 * REMAKE the pictures deliberately, when the interface they document changes.
 *
 * THE PROTOCOL, identical for the fourteen: viewport 1280 × 860 at scale 1,
 * light reader scheme (the OS preference — the app stays on « System », which
 * is what the Appearance card must be seen saying), one browser context per
 * language, and the BUILT deliverable served over http so it reaches its
 * neighbour sample file the way a deployment does.
 *
 * TWO STAGINGS, and only two.
 *
 * 1. THE SAMPLE SET, booted through `?sample` — the deliverable fetches
 *    `dist/sample-portfolio.{en,fr}.json` next door and imports it through the
 *    ordinary parse. Twelve of the fourteen pictures are that set, untouched:
 *    the identity, the logo and the twenty projects they show are the ones
 *    that ship, so a change to the sample file reaches the pictures on the
 *    next run and cannot silently part ways with them.
 *
 * 2. THE CARRIED ASSETS, staged here — the two `embedded-font` pictures. They
 *    show the Appearance card's portfolio-identity half with all three carried
 *    assets present at once: the portfolio's own twelve colours heading the
 *    palette list, two embedded font faces with their weight and size, and a
 *    logo. No sample set carries the palette or the faces and no story stages
 *    the three together, so this staging is the only place the screen exists.
 *    The logo is READ FROM THE SAMPLE FILE rather than invented here — one
 *    mark for the fourteen pictures, and one file to change when it changes.
 *
 * THE TYPE THE STAGING EMBEDS. `Atelier` is this repository's fictional family
 * — the guides and the contract tests use that name for « a family this build
 * does not bundle » — and the BYTES behind it are Inter's, from
 * `@fontsource/inter` (OFL-1.1, already a dependency here). Real glyphs and
 * real weights, so the card's sizes are the sizes a real embedding produces;
 * nothing of the font is committed, and the second argument takes a licensed
 * face instead when one is wanted for both weights.
 */
import { createServer } from 'node:http'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { extname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
/** The single-file deliverable — the artifact people actually download. */
const APP = 'dist/project-review.html'
const OUT = resolve(ROOT, process.argv[2] ?? 'docs/images')

const LANGUAGES = ['en', 'fr']
/** One context per language; the boot reads `navigator.language`. */
const LOCALE = { en: 'en-GB', fr: 'fr-FR' }
const VIEWPORT = { width: 1280, height: 860 }
/** Layout, fonts and the save bar have settled well inside this. */
const SETTLE = 500
/** The slideshow's own transitions are longer — see `slideshowOnSheet`. */
const REVEAL_SETTLE = 2000

/** Inter's latin face for one weight. Resolved FROM THE APP's manifest, which
 * is the workspace that declares `@fontsource/inter` — not from a hoist this
 * root happens to enjoy. */
const fromApp = createRequire(join(ROOT, 'app/package.json'))
const inter = (weight) =>
  fromApp.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff2`)
const OVERRIDE = process.argv[3] === undefined ? undefined : resolve(process.argv[3])

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.json': 'application/json',
}

/** The sample set: twenty projects, thirty-four derived slides. */
const SAMPLE_PROJECTS = 20
/** Flat position of the P-01 sheet in that deck — the `slide` picture. */
const P01_SLIDE = { page: 8, total: 34 }

/**
 * The interface labels this script has to click on or read back. They are
 * restated here rather than imported: this file is plain node over the BUILT
 * deliverable and imports nothing from the source — the same rule the smoke
 * and a11y runs follow. A label that moves makes a step fail by name, which
 * is the wanted failure.
 */
const LABEL = {
  importNav: { en: 'Import…', fr: 'Importer…' },
  paste: { en: 'JSON to import', fr: 'JSON à importer' },
  mergeMode: {
    en: 'Merge the projects into the current portfolio',
    fr: 'Fusionner les projets dans le portefeuille courant',
  },
  previewSlide: { en: 'Preview the slide', fr: 'Aperçu de la slide' },
  openSlideshow: { en: 'Open the slideshow here', fr: 'Ouvrir le diaporama ici' },
  identity: { en: 'Portfolio identity', fr: 'Identité du portefeuille' },
  houseColours: { en: 'House colours', fr: 'Couleurs maison' },
  projectsTotal: {
    en: `${SAMPLE_PROJECTS} projects`,
    fr: `${SAMPLE_PROJECTS} projets`,
  },
}

/** Static file server over the repo root — same pattern as a11y.mjs. */
function serve(root) {
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? '/').split('?')[0])
    readFile(join(root, path))
      .then((body) => {
        response.writeHead(200, {
          'content-type': MIME[extname(path)] ?? 'application/octet-stream',
        })
        response.end(body)
      })
      .catch(() => {
        response.writeHead(404)
        response.end()
      })
  })
  return new Promise((ready) => server.listen(0, '127.0.0.1', () => ready(server)))
}

/** Stops on the first staging that no longer reaches its screen. */
function fail(message) {
  console.error(`stage-doc-images: ${message}`)
  process.exit(1)
}

const written = []

/** A path under the repo reads better relative to it; a scratch directory
 * elsewhere reads better whole. */
const show = (path) => (path.startsWith(`${ROOT}/`) ? relative(ROOT, path) : path)

/** Writes one picture and records the line the run ends with. */
async function shoot(page, name) {
  const file = join(OUT, `${name}.png`)
  await page.screenshot({ path: file })
  const { size } = await stat(file)
  written.push(`${show(file)} — ${VIEWPORT.width}×${VIEWPORT.height} · ${size} B`)
}

/* ======================= 1. the sample-set pictures ======================= */

/**
 * The contribution file the merge picture shows — built from the sample set
 * itself, so it stays a real portfolio the strict parse accepts.
 *
 * Three projects: the first KEEPS its id (the homonym the merge replaces in
 * place) and the next two arrive under ids the portfolio does not hold (the
 * two the merge appends). Categories and free slides ride along untouched —
 * a merge ignores the incoming review, settings and free slides, but the
 * parse still counts them, which is what the picture's first line reports.
 * The figures are therefore fixed by construction: 1 replaced, 2 added.
 */
const contribution = (sample) => ({
  ...sample,
  projects: [
    sample.projects[0],
    { ...sample.projects[1], id: 'P-21' },
    { ...sample.projects[2], id: 'P-22' },
  ],
})

/** Opens the import dialog on a pasted contribution, in merge mode. */
async function importMerge(page, language, sample) {
  await page.getByRole('button', { name: LABEL.importNav[language] }).click()
  const paste = page.getByRole('textbox', { name: LABEL.paste[language] })
  await paste.fill(JSON.stringify(contribution(sample)))
  await page.getByRole('radio', { name: LABEL.mergeMode[language] }).click()
  await page.waitForTimeout(SETTLE)
  // The textarea is a window onto a long file: show its END, which is where a
  // paste leaves it and where the closing braces prove the file is whole.
  await paste.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  // ASSERT THE PREVIEW, DO NOT ASSUME IT. An empty list would still screenshot
  // a perfectly composed dialog — and would document a merge that replaces
  // nothing, which is not the screen the guides point at.
  const listed = await page.getByRole('dialog').getByRole('listitem').allInnerTexts()
  const wanted = sample.projects[0].id
  if (listed.length !== 1 || !listed[0].includes(wanted)) {
    fail(`${language}: the merge preview should list ${wanted} alone, got [${listed.join(' | ')}]`)
  }
}

/** Opens the slideshow ON the P-01 sheet, through the sheet's own preview. */
async function slideshowOnSheet(page, language) {
  await page.getByRole('button', { name: LABEL.previewSlide[language] }).first().click()
  await page.getByRole('button', { name: LABEL.openSlideshow[language] }).click()
  await page.waitForSelector('.reveal.ready', { timeout: 20_000 })
  // Away from the top edge: the exit bar shows on hover there, and the
  // pictures document the slide, not the bar.
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2)
  // Reveal fades its arrows in and animates the progress bar: a shot taken
  // mid-transition is a picture that differs from the next run's for no
  // reason anyone could name. Wait them out instead.
  await page.waitForTimeout(REVEAL_SETTLE)
  // `.slide.present` is the slide itself: its drawer — `section.stack` — wears
  // `present` too, and a foot read off the drawer is the LAST sheet in it.
  const foot = await page.locator('.reveal .slide.present .slide-foot').innerText()
  if (!foot.includes(`${P01_SLIDE.page} / ${P01_SLIDE.total}`)) {
    fail(`${language}: the slideshow opened on "${foot.replace(/\s+/g, ' ')}", not the P-01 sheet`)
  }
}

/**
 * The six pictures of the shipped sample set, in one context. `?sample` boots
 * it the way the online demo does: the deliverable fetches its neighbour file
 * and imports it through the ordinary parse — nothing is seeded by hand here,
 * so these six can only ever show what the sample file actually holds.
 */
async function samplePictures(browser, base, language, sample) {
  const context = await browser.newContext({
    locale: LOCALE[language],
    viewport: VIEWPORT,
    colorScheme: 'light',
  })
  const page = await context.newPage()
  const app = `${base}/${APP}?sample`

  // Routes are HASHES: moving between two of them is a same-document
  // navigation, so whatever a previous picture opened — a modal, here — is
  // still open on arrival. Escape first, and the shot documents the route
  // rather than the leftovers of the one before it.
  const open = async (hash) => {
    await page.keyboard.press('Escape')
    await page.goto(`${app}${hash}`)
    await page.waitForSelector('.editor')
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await page.waitForTimeout(SETTLE)
  }

  await open('#/projects')
  // The whole staging rests on this one fetch: a `?sample` that failed to boot
  // leaves an EMPTY portfolio, and every picture below would then document a
  // blank app while looking perfectly well composed.
  if (!(await page.getByText(LABEL.projectsTotal[language]).first().isVisible())) {
    fail(`${language}: ?sample did not boot the ${SAMPLE_PROJECTS}-project sample set`)
  }
  await shoot(page, `${language}-projects`)

  await open('#/review')
  await shoot(page, `${language}-review`)

  await open('#/sheet/P-01')
  await shoot(page, `${language}-sheet`)

  await open('#/settings')
  await shoot(page, `${language}-settings`)

  await open('#/review')
  await importMerge(page, language, sample)
  await shoot(page, `${language}-import-merge`)

  await open('#/sheet/P-01')
  await slideshowOnSheet(page, language)
  await shoot(page, `${language}-slide`)

  await context.close()
}

/* ===================== 2. the carried-assets pictures ===================== */

/** The house palette of the pictures: the twelve domain colours, restated by
 * the portfolio itself so the list is headed by « House colours ». */
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

/**
 * The staged portfolio: THE SAMPLE SET, with the three carried assets added to
 * its theme and nothing else touched. Building a bare portfolio instead would
 * put an empty right-hand column in a documentation picture — and would give
 * the identity and the logo a second home, which is how the mark went stale in
 * the first place. The sample file stays the one source for all fourteen.
 */
const staging = (language, sample, faces) => ({
  ...sample,
  settings: {
    ...sample.settings,
    theme: {
      ...sample.settings.theme,
      font: 'Atelier',
      fontFaces: faces,
      customPalette: { label: LABEL.houseColours[language], colors: HOUSE_COLORS },
    },
  },
})

/**
 * Where the card's identity half starts: the « Portfolio identity » heading,
 * read from the live DOM rather than hard-coded, so the framing follows the
 * card instead of a pixel someone once measured.
 */
const headingTop = (page, heading) =>
  page.evaluate((text) => {
    const h3 = [...document.querySelectorAll('h3')].find((el) => el.textContent?.trim() === text)
    return h3 === undefined ? null : Math.round(h3.getBoundingClientRect().top + window.scrollY)
  }, heading)

/** The heading sits this far below the top edge — the section then fills the
 * frame down to the licence line that closes it. */
const HEADING_INSET = 24

async function carriedAssetsPicture(browser, base, language, sample, faces) {
  const context = await browser.newContext({
    locale: LOCALE[language],
    viewport: VIEWPORT,
    colorScheme: 'light',
  })
  // The staged document goes in as a stored envelope, which is how the app
  // boots into a portfolio without anyone clicking through an import.
  // `format` is `STATE_FORMAT` (core's services/persistence.ts).
  await context.addInitScript(
    (raw) => localStorage.setItem('project-review/state', raw),
    JSON.stringify({
      format: 1,
      revision: 1,
      portfolio: staging(language, sample, faces),
      history: { past: [], future: [] },
    }),
  )
  const page = await context.newPage()
  await page.goto(`${base}/${APP}#/settings`)
  await page.waitForSelector('.editor')
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForTimeout(SETTLE)

  const top = await headingTop(page, LABEL.identity[language])
  if (top === null)
    fail(`${language}: the portfolio-identity heading was not found — card changed?`)
  await page.evaluate((y) => window.scrollTo(0, y), top - HEADING_INSET)
  await page.waitForTimeout(SETTLE)
  await shoot(page, `${language}-embedded-font`)
  await context.close()
}

/* ================================= run =================================== */

/** The two faces the staging embeds — Inter's own 400 and 700, or the one
 * face the caller named, used for both weights. */
async function embeddedFaces() {
  const files = OVERRIDE === undefined ? [inter(400), inter(700)] : [OVERRIDE, OVERRIDE]
  const faces = []
  for (const [index, file] of files.entries()) {
    const bytes = await readFile(file)
    faces.push({
      family: 'Atelier',
      weight: ['400', '700'][index],
      style: 'normal',
      dataUri: `data:font/woff2;base64,${bytes.toString('base64')}`,
    })
  }
  return faces
}

async function main() {
  if (!existsSync(join(DIST, 'project-review.html'))) {
    fail('missing dist/project-review.html — run `pnpm run build` first.')
  }
  const faces = await embeddedFaces()
  await mkdir(OUT, { recursive: true })

  const server = await serve(ROOT)
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ chromiumSandbox: false })
  try {
    for (const language of LANGUAGES) {
      // The very file the deliverable fetches next door: the pictures and the
      // app read one sample set, never two.
      const sample = JSON.parse(
        await readFile(join(DIST, `sample-portfolio.${language}.json`), 'utf8'),
      )
      await samplePictures(browser, base, language, sample)
      await carriedAssetsPicture(browser, base, language, sample, faces)
    }
  } finally {
    await browser.close()
    server.close()
  }

  for (const line of written) console.log(line)
  console.log(`${written.length} pictures in ${show(OUT) || '.'}`)
}

await main()
