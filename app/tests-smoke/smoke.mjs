/**
 * file:// smoke test of the BUILT single-file deliverable — plain node +
 * Playwright, deliberately outside vitest: what boots here is the exact file
 * a user double-clicks, engine, router and export included. This run is what
 * the `v8 ignore` justifications of the DOM halves (hash-router, dom-export,
 * route binding) point at.
 *
 * PRECONDITION: `bun run build` first — the script drives app/dist/ as built
 * (`bun run smoke` from the root; CI runs it right after the build step).
 *
 * Covered, with zero console errors tolerated anywhere:
 *   1. empty boot in fr AND en (browser locale decides the first language);
 *   2. `?sample` boots the 20-project demo set;
 *   3. hash navigation: #/projects → #/sheet/P-01 → back;
 *   4. the FR | EN top-bar switch relabels the shell and <html lang>;
 *   5. « Générer le diaporama » boots reveal with the 34 derived slides;
 *   6. « Enregistrer » downloads the standalone deck; the saved file carries
 *      the CSP <meta> and re-opens from file:// without a single console
 *      error, reveal booted.
 */

import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { chromium } from 'playwright'

const DIST = resolve(import.meta.dirname, '../dist/project-review.html')
const APP_URL = pathToFileURL(DIST).href
/** The sample data set (fr and en alike) holds 20 projects, deriving 34 slides. */
const SAMPLE_PROJECTS = 20
const SAMPLE_SLIDES = 34

let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? '  ok' : 'FAIL'} — ${label}`)
  if (!ok) failures += 1
}

/** Console/page errors of one page, harvested as they happen. */
const watchErrors = (page, bucket) => {
  page.on('console', (message) => {
    if (message.type() === 'error') bucket.push(message.text())
  })
  page.on('pageerror', (error) => bucket.push(String(error)))
}

const settle = (page) => page.waitForTimeout(250)

async function emptyBoot(browser, locale, lang, projectsLabel) {
  const context = await browser.newContext({ locale })
  const page = await context.newPage()
  const errors = []
  watchErrors(page, errors)
  await page.goto(APP_URL)
  await settle(page)
  check(
    (await page.getAttribute('html', 'lang')) === lang,
    `empty boot ${locale}: <html lang="${lang}">`,
  )
  check(
    await page.getByRole('link', { name: projectsLabel }).isVisible(),
    `empty boot ${locale}: nav says "${projectsLabel}"`,
  )
  check(
    errors.length === 0,
    `empty boot ${locale}: zero console errors${errors.length ? ` — ${errors[0]}` : ''}`,
  )
  await context.close()
}

async function main() {
  await access(DIST).catch(() => {
    console.error(`Missing ${DIST} — run \`bun run build\` first (documented precondition).`)
    process.exit(1)
  })

  // `chromiumSandbox: false`: the script must run identically on a developer
  // machine, in a container and on the CI runner.
  const browser = await chromium.launch({ chromiumSandbox: false })
  const downloads = await mkdtemp(join(tmpdir(), 'project-review-smoke-'))

  try {
    /* ---- 1. empty boot, both languages (locale drives the first language) */
    await emptyBoot(browser, 'fr-FR', 'fr', 'Projets')
    await emptyBoot(browser, 'en-US', 'en', 'Projects')

    /* ---- 2-6. the full French session on the sample set ---- */
    const context = await browser.newContext({ locale: 'fr-FR' })
    const page = await context.newPage()
    const errors = []
    watchErrors(page, errors)

    await page.goto(`${APP_URL}?sample`)
    await settle(page)

    // 2. sample boot: 20 projects on the Projects screen.
    await page.goto(`${APP_URL}?sample#/projects`)
    await settle(page)
    check(
      await page.getByText(`${SAMPLE_PROJECTS} projets`).first().isVisible(),
      `?sample: the Projects screen counts ${SAMPLE_PROJECTS} projects`,
    )

    // 3. hash navigation: the sheet of P-01, then back.
    await page.goto(`${APP_URL}?sample#/sheet/P-01`)
    await settle(page)
    check(
      await page.getByRole('button', { name: '‹ Portefeuille' }).isVisible(),
      'navigation: #/sheet/P-01 shows the sheet screen',
    )
    check(
      (await page.locator('.breadcrumb .current').textContent())?.trim() === 'P-01',
      'navigation: the sheet is P-01',
    )
    await page.goBack()
    await settle(page)
    check(page.url().endsWith('#/projects'), 'navigation: back returns to #/projects')

    // 4. FR | EN switch: same command as Settings, whole shell relabels.
    await page.getByRole('button', { name: 'EN', exact: true }).click()
    await settle(page)
    check((await page.getAttribute('html', 'lang')) === 'en', 'FR|EN switch: <html lang="en">')
    check(
      await page.getByRole('link', { name: 'Projects' }).isVisible(),
      'FR|EN switch: nav relabels to "Projects"',
    )
    await page.getByRole('button', { name: 'FR', exact: true }).click()
    await settle(page)

    // 5. the slideshow: reveal boots on the 34 derived sections.
    await page.getByRole('button', { name: /Générer le diaporama/ }).click()
    await page.waitForSelector('.reveal.ready', { timeout: 20_000 })
    const sections = await page.locator('.reveal .slides section.slide').count()
    check(
      sections === SAMPLE_SLIDES,
      `slideshow: ${SAMPLE_SLIDES} slides derived (got ${sections})`,
    )

    // 6. « Enregistrer »: the standalone file downloads, carries the CSP and
    // re-opens from file:// without one console error.
    await page.mouse.move(640, 4) // the exit bar lives on the top edge
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Enregistrer' }).click(),
    ])
    const exported = join(downloads, download.suggestedFilename())
    await download.saveAs(exported)
    const html = await readFile(exported, 'utf8')
    check(
      html.includes('http-equiv="Content-Security-Policy"') && html.includes("script-src 'nonce-"),
      'export: the standalone file carries the nonce CSP <meta>',
    )

    check(
      errors.length === 0,
      `editor session: zero console errors${errors.length ? ` — ${errors[0]}` : ''}`,
    )
    await context.close()

    const standaloneContext = await browser.newContext()
    const standalonePage = await standaloneContext.newPage()
    const standaloneErrors = []
    watchErrors(standalonePage, standaloneErrors)
    await standalonePage.goto(pathToFileURL(exported).href)
    await standalonePage.waitForSelector('.reveal.ready', { timeout: 20_000 })
    const standaloneSections = await standalonePage.locator('.reveal .slides section.slide').count()
    check(
      standaloneSections === SAMPLE_SLIDES,
      `export: the standalone deck re-opens with its ${SAMPLE_SLIDES} slides (got ${standaloneSections})`,
    )
    check(
      standaloneErrors.length === 0,
      `export: standalone file:// run, zero console errors${standaloneErrors.length ? ` — ${standaloneErrors[0]}` : ''}`,
    )
    await standaloneContext.close()
  } finally {
    await browser.close()
    await rm(downloads, { recursive: true, force: true })
  }

  if (failures > 0) {
    console.error(`\nsmoke: ${failures} check(s) failed`)
    process.exit(1)
  }
  console.log('\nsmoke: all checks passed')
}

await main()
