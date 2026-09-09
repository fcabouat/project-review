/**
 * file:// smoke test of the BUILT single-file deliverable — plain node +
 * Playwright, deliberately outside vitest: what boots here is the exact file
 * a user double-clicks, engine, router and export included. This run is what
 * the `v8 ignore` justifications of the DOM halves (hash-router, dom-export,
 * route binding) point at.
 *
 * PRECONDITION: `bun run build` first — the script drives dist/ as built
 * (`bun run smoke` from the root; CI runs it right after the build step).
 *
 * Covered, with zero console errors tolerated anywhere:
 *   1. empty boot in fr AND en (browser locale decides the first language);
 *   2. `?sample` boots the 20-project demo set;
 *   3. hash navigation: #/projects → #/sheet/P-01 → back;
 *   4. the FR | EN top-bar switch relabels the shell and <html lang>; its
 *      scheme-toggle twin stamps (and removes) the `dark` class on <html>;
 *   5. « Générer le diaporama » boots reveal with the 34 derived slides;
 *   6. « Enregistrer » downloads the standalone deck; the saved file carries
 *      the CSP <meta>, embarks NO `.dark` rule (the editor's reader scheme
 *      must not travel), and re-opens from file:// without a single console
 *      error, reveal booted;
 *   7. the 390×844 touch pass: boot, nav drawer, a sheet opened from the
 *      table, the slideshow scaled to fit with its exit bar pinned (no hover
 *      on touch), the standalone export — and never a horizontal body scroll.
 */

import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { chromium } from 'playwright'

const DIST = resolve(import.meta.dirname, '../../dist/project-review.html')
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
      (await page.getByRole('textbox', { name: 'ID', exact: true }).inputValue()) === 'P-01',
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

    // 4b. the top-bar scheme toggle (FR|EN's twin, same store as Settings):
    // Sombre stamps the `dark` class, Système removes it (headless prefers
    // light) — the editor flips, the slides stay pinned light.
    const schemeGroup = page.getByRole('group', { name: /Thème de l/ })
    await schemeGroup.getByRole('button', { name: 'Sombre' }).click()
    await settle(page)
    check(
      await page.evaluate(() => document.documentElement.classList.contains('dark')),
      'scheme toggle: Sombre stamps the dark class on <html>',
    )
    await schemeGroup.getByRole('button', { name: 'Système' }).click()
    await settle(page)
    check(
      await page.evaluate(() => !document.documentElement.classList.contains('dark')),
      'scheme toggle: back to Système removes it',
    )

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
      !/\.dark\b/.test(html),
      'export: no `.dark` rule embarked — the reader scheme stays with the editor',
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

    /* ---- 7. the mobile pass: 390×844, touch, French sample ---- */
    const mobile = await browser.newContext({
      locale: 'fr-FR',
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
    const mp = await mobile.newPage()
    const mobileErrors = []
    watchErrors(mp, mobileErrors)
    const noBodyScroll = async (label) =>
      check(
        await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `mobile: no horizontal body scroll on ${label}`,
      )

    await mp.goto(`${APP_URL}?sample`)
    await settle(mp)
    check(
      await mp.getByRole('button', { name: 'Ouvrir la navigation' }).isVisible(),
      'mobile: boot shows the hamburger (drawer mode)',
    )
    await noBodyScroll('review')

    // Drawer: open from the hamburger, navigate to Projects, drawer closes.
    await mp.getByRole('button', { name: 'Ouvrir la navigation' }).click()
    await settle(mp)
    const drawerLink = mp.getByRole('dialog').getByRole('link', { name: 'Projets' })
    check(await drawerLink.isVisible(), 'mobile: the nav drawer opens with the full nav')
    await drawerLink.click()
    await settle(mp)
    check(mp.url().endsWith('#/projects'), 'mobile: drawer navigation lands on #/projects')
    check(
      (await mp.getByRole('dialog').count()) === 0,
      'mobile: the drawer closes after navigating',
    )
    await noBodyScroll('projects (the table scrolls inside its own container)')

    // Open the P-01 sheet from the table: the edit control sits at the far
    // right of the 11-column grid — Playwright scrolls it into view inside
    // the internal scroller, exactly like a finger would.
    await mp.getByRole('button', { name: 'Modifier P-01' }).click()
    await settle(mp)
    check(
      (await mp.getByRole('textbox', { name: 'ID', exact: true }).inputValue()) === 'P-01',
      'mobile: the sheet P-01 opens from the table',
    )
    await noBodyScroll('sheet')

    // Slideshow: reveal boots, the 1280-wide canvas is SCALED to fit (no
    // reflow), and the exit bar is pinned visible — touch knows no hover.
    await mp.getByRole('button', { name: /Générer le diaporama/ }).click()
    await mp.waitForSelector('.reveal.ready', { timeout: 20_000 })
    await mp.waitForTimeout(400)
    const scaledWidth = await mp.evaluate(() => {
      const slides = document.querySelector('.reveal .slides')
      return slides ? slides.getBoundingClientRect().width : Number.NaN
    })
    check(
      scaledWidth > 0 && scaledWidth <= 390,
      `mobile: the deck is dezoomed to fit 390 px (canvas ${Math.round(scaledWidth)} px)`,
    )
    const barVisible = await mp.evaluate(() => {
      const bar = document.querySelector('.exit-bar')
      return bar !== null && getComputedStyle(bar).opacity === '1'
    })
    check(barVisible, 'mobile: the exit bar is pinned visible on touch screens')

    // Export from the phone: the same standalone download.
    const [mobileDownload] = await Promise.all([
      mp.waitForEvent('download'),
      mp.getByRole('button', { name: 'Enregistrer' }).click(),
    ])
    const mobileExport = join(downloads, `mobile-${mobileDownload.suggestedFilename()}`)
    await mobileDownload.saveAs(mobileExport)
    const mobileHtml = await readFile(mobileExport, 'utf8')
    check(
      mobileHtml.includes('http-equiv="Content-Security-Policy"'),
      'mobile: the export downloads the standalone deck',
    )
    await mp.getByRole('button', { name: '✕ Fermer' }).click()
    await settle(mp)

    check(
      mobileErrors.length === 0,
      `mobile: zero console errors${mobileErrors.length ? ` — ${mobileErrors[0]}` : ''}`,
    )
    await mobile.close()
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
