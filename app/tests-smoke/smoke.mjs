/**
 * Smoke test of the BUILT single-file deliverable — plain node + Playwright,
 * deliberately outside vitest: what boots here is the exact file a user
 * double-clicks, engine, router and export included. This run is what the
 * `v8 ignore` justifications of the DOM halves (hash-router, dom-export,
 * fonts' FileReader, route binding) point at.
 *
 * PRECONDITION: `bun run build` first — the script drives dist/ as built
 * (`bun run smoke` from the root; CI runs it right after the build step).
 *
 * Two transports, mirroring real life:
 * - file:// — the double-clicked deliverable: empty boots in fr AND en, and
 *   `?sample` degrading to a SILENT empty boot (no http neighbour to fetch);
 * - http — a static server over the repo root (the deployment story): the
 *   `?sample` sessions fetch `dist/sample-portfolio.{fr,en}.json` from next
 *   door, exactly as the landing's « Try it » link does on Pages.
 *
 * Covered, with zero console errors tolerated anywhere (no session names a
 * family the deployment would have to serve, so no face request fires):
 *   0. recovery: a stored snapshot the format refuses opens the recovery
 *      screen instead of the editor, survives boot+reload byte for byte, comes
 *      back verbatim on download, and is erased only on an explicit choice;
 *   1. file://: empty boot in fr AND en; `?sample` boots EMPTY, silently;
 *   2. http `?sample` boots the 20-project demo set;
 *   3. hash navigation: #/projects → #/sheet/P-01 → back;
 *   4. the top-bar language MENU relabels the shell and <html lang>; the
 *      scheme MENU stamps (and removes) the `dark` class on <html>;
 *   5. « Générer le diaporama » boots reveal with the 34 derived slides;
 *   6. « Enregistrer » downloads the standalone deck; the saved file carries
 *      the CSP <meta>, embarks NO `.dark` rule, and re-opens from file://
 *      without a single console error, reveal booted;
 *   7. closing the slideshow RESTORES focus to the generate button;
 *   8. the embed scenario: a fabricated .woff2 fixture picked through the
 *      Settings card → live «embedded» status → standalone export carries the
 *      data-URI face and SERVES it from file:// → `?print` renders its 34
 *      pages with the embedded face loaded;
 *   9. the 390×844 touch pass: boot, nav drawer, a sheet opened from the
 *      table, the slideshow scaled to fit with its exit bar pinned, the
 *      standalone export — and never a horizontal body scroll.
 */

import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { chromium } from 'playwright'

const ROOT = resolve(import.meta.dirname, '../..')
const DIST = join(ROOT, 'dist/project-review.html')
const FILE_APP = pathToFileURL(DIST).href
const FONT_FIXTURE = resolve(import.meta.dirname, 'fixtures/TestFace-Regular.woff2')
/** The sample data set (fr and en alike) holds 20 projects, deriving 34 slides. */
const SAMPLE_PROJECTS = 20
const SAMPLE_SLIDES = 34

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.json': 'application/json',
}

/** Static file server over the repo root — same pattern as a11y.mjs. */
function serve(root) {
  const server = createServer(async (request, response) => {
    const path = (request.url ?? '/').split('?')[0]
    // A blank page on the app's ORIGIN, for seeding localStorage before the
    // app ever runs: seeding from the app's own page would race its save
    // debounce, which fires on navigation and would overwrite the seed.
    if (path === '/__seed.html') {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<!doctype html><meta charset="utf-8"><title>seed</title>')
      return
    }
    try {
      const body = await readFile(join(root, decodeURIComponent(path)))
      response.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' })
      response.end(body)
    } catch {
      response.writeHead(404)
      response.end()
    }
  })
  return new Promise((ready) => server.listen(0, '127.0.0.1', () => ready(server)))
}

let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? '  ok' : 'FAIL'} — ${label}`)
  if (!ok) failures += 1
}

/**
 * Console/page errors of one page, harvested as they happen.
 *
 * ONE targeted tolerance, documented: the 404 of a DEPLOYED family's faces
 * (`fonts/<family>/*.woff2`, which this repository deploys for nobody) is
 * INHERENT to serving an optional face — the standalone export probes those
 * `@font-face` URLs over http to inline them and DROPS the rule cleanly when
 * they are absent (asserted below: the exported file carries no such URL).
 * Everything else still fails the zero-error gate.
 */
const watchErrors = (page, bucket) => {
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    if (/\/fonts\/[^/]+\/[^/]+\.woff2/.test(message.location().url)) return
    bucket.push(message.text())
  })
  page.on('pageerror', (error) => bucket.push(String(error)))
}

const settle = (page) => page.waitForTimeout(250)

async function emptyBoot(browser, locale, lang, projectsLabel) {
  const context = await browser.newContext({ locale })
  const page = await context.newPage()
  const errors = []
  watchErrors(page, errors)
  await page.goto(FILE_APP)
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

  const server = await serve(ROOT)
  const HTTP_ORIGIN = `http://127.0.0.1:${server.address().port}`
  const HTTP_APP = `${HTTP_ORIGIN}/dist/project-review.html`

  // `chromiumSandbox: false`: the script must run identically on a developer
  // machine, in a container and on the CI runner.
  const browser = await chromium.launch({ chromiumSandbox: false })
  const downloads = await mkdtemp(join(tmpdir(), 'project-review-smoke-'))

  try {
    /* ---- 1. file://: empty boots, and ?sample degrading silently ---- */
    await emptyBoot(browser, 'fr-FR', 'fr', 'Projets')
    await emptyBoot(browser, 'en-US', 'en', 'Projects')

    const fileContext = await browser.newContext({ locale: 'fr-FR' })
    const filePage = await fileContext.newPage()
    const fileErrors = []
    watchErrors(filePage, fileErrors)
    await filePage.goto(`${FILE_APP}?sample#/projects`)
    await settle(filePage)
    check(
      await filePage.getByText('Aucun projet — commencez par en ajouter un.').isVisible(),
      'file:// ?sample: no neighbour to fetch — boots EMPTY',
    )
    check(
      fileErrors.length === 0,
      `file:// ?sample: zero console errors${fileErrors.length ? ` — ${fileErrors[0]}` : ''}`,
    )
    await fileContext.close()

    /* ---- 2-7. the full French session on the http-served sample ---- */
    const context = await browser.newContext({ locale: 'fr-FR' })
    const page = await context.newPage()
    const errors = []
    watchErrors(page, errors)

    await page.goto(`${HTTP_APP}?sample`)
    await settle(page)

    // 2. sample boot: 20 projects on the Projects screen.
    await page.goto(`${HTTP_APP}?sample#/projects`)
    await settle(page)
    check(
      await page.getByText(`${SAMPLE_PROJECTS} projets`).first().isVisible(),
      `http ?sample: the Projects screen counts ${SAMPLE_PROJECTS} projects`,
    )

    // 3. hash navigation: the sheet of P-01, then back.
    await page.goto(`${HTTP_APP}?sample#/sheet/P-01`)
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

    // 4. language MENU: same command as Settings, whole shell relabels.
    await page.getByRole('button', { name: /Langue de l'application/ }).click()
    await page.getByRole('menuitem', { name: 'English' }).click()
    await settle(page)
    check((await page.getAttribute('html', 'lang')) === 'en', 'language menu: <html lang="en">')
    check(
      await page.getByRole('link', { name: 'Projects' }).isVisible(),
      'language menu: nav relabels to "Projects"',
    )
    await page.getByRole('button', { name: /Application language/ }).click()
    await page.getByRole('menuitem', { name: 'Français' }).click()
    await settle(page)

    // 4b. the top-bar scheme MENU (the language menu's twin, same store as
    // Settings): Sombre stamps the `dark` class, Système removes it (headless
    // prefers light) — the editor flips, the slides stay pinned light.
    await page.getByRole('button', { name: /Thème de l'interface/ }).click()
    await page.getByRole('menuitem', { name: 'Sombre' }).click()
    await settle(page)
    check(
      await page.evaluate(() => document.documentElement.classList.contains('dark')),
      'scheme menu: Sombre stamps the dark class on <html>',
    )
    await page.getByRole('button', { name: /Thème de l'interface/ }).click()
    await page.getByRole('menuitem', { name: 'Système' }).click()
    await settle(page)
    check(
      await page.evaluate(() => !document.documentElement.classList.contains('dark')),
      'scheme menu: back to Système removes it',
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
      !/url\(["']?[^"')]*fonts\/[^"')]+\.woff2/.test(html),
      'export: the unreachable faces of a deployed family are dropped whole',
    )

    // 7. closing the show RESTORES focus to the button that opened it.
    await page.mouse.move(640, 4)
    await page.getByRole('button', { name: '✕ Fermer' }).click()
    await settle(page)
    check(
      await page.evaluate(() =>
        (document.activeElement?.textContent ?? '').includes('Générer le diaporama'),
      ),
      'close: focus returns to « Générer le diaporama »',
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

    /* ---- 8. the embed scenario: fixture woff2 → export → file:// → print ---- */
    const embedContext = await browser.newContext({ locale: 'fr-FR' })
    const ep = await embedContext.newPage()
    const embedErrors = []
    watchErrors(ep, embedErrors)

    await ep.goto(`${HTTP_APP}?sample#/settings`)
    await settle(ep)
    // Embed FIRST, then name the family: a covered family declares no
    // deployed face at all (precedence embedded > bundled > deployed).
    await ep.setInputFiles('input[accept=".woff2,font/woff2"]', FONT_FIXTURE)
    await settle(ep)
    check(
      await ep.getByText('TestFace').first().isVisible(),
      'embed: the picked face is listed (family read from the file name)',
    )
    const fontField = ep.getByRole('textbox', { name: 'Police' })
    await fontField.fill('TestFace')
    await fontField.press('Tab')
    await settle(ep)
    check(
      await ep.getByText('Police embarquée dans le portefeuille.').isVisible(),
      'embed: the live status answers «embedded» — no probe, no network',
    )

    // The export carries the face as a data URI and SERVES it from file://.
    await ep.getByRole('button', { name: /Générer le diaporama/ }).click()
    await ep.waitForSelector('.reveal.ready', { timeout: 20_000 })
    await ep.mouse.move(640, 4)
    const [embedDownload] = await Promise.all([
      ep.waitForEvent('download'),
      ep.getByRole('button', { name: 'Enregistrer' }).click(),
    ])
    const embedExport = join(downloads, `embed-${embedDownload.suggestedFilename()}`)
    await embedDownload.saveAs(embedExport)
    const embedHtml = await readFile(embedExport, 'utf8')
    check(
      embedHtml.includes('data:font/woff2;base64,d09GMg') &&
        /font-family:\s*['"]?TestFace/.test(embedHtml) &&
        embedHtml.includes('font-src data:'),
      'embed export: the @font-face data URI is emitted under the font-src data: CSP',
    )
    await ep.mouse.move(640, 4)
    await ep.getByRole('button', { name: '✕ Fermer' }).click()
    await settle(ep)

    const embedStandalone = await browser.newContext()
    const esPage = await embedStandalone.newPage()
    const esErrors = []
    watchErrors(esPage, esErrors)
    await esPage.goto(pathToFileURL(embedExport).href)
    await esPage.waitForSelector('.reveal.ready', { timeout: 20_000 })
    check(
      await esPage.evaluate(async () => {
        const faces = await document.fonts.load('16px TestFace')
        return faces.length > 0 && document.fonts.check('16px TestFace')
      }),
      'embed export: TestFace is SERVED from file:// (document.fonts.check)',
    )
    check(
      esErrors.length === 0,
      `embed export: file:// run, zero console errors${esErrors.length ? ` — ${esErrors[0]}` : ''}`,
    )
    await embedStandalone.close()

    // ?print in the SAME context: local save persisted the embedded face —
    // the flat 34-page render uses it (Chrome print embeds loaded glyphs).
    await ep.goto(`${HTTP_APP}?print`)
    await ep.waitForSelector('.rp-print-root .slide', { timeout: 20_000 })
    const printPages = await ep.locator('.rp-print-root .slide').count()
    check(
      printPages === SAMPLE_SLIDES,
      `embed ?print: ${SAMPLE_SLIDES} A4 pages laid out (got ${printPages})`,
    )
    check(
      await ep.evaluate(async () => {
        const faces = await document.fonts.load('16px TestFace')
        return faces.length > 0 && document.fonts.check('16px TestFace')
      }),
      'embed ?print: the embedded face is loaded for the print render',
    )
    check(
      embedErrors.length === 0,
      `embed session: zero console errors${embedErrors.length ? ` — ${embedErrors[0]}` : ''}`,
    )
    await embedContext.close()

    /* ---- 9. the mobile pass: 390×844, touch, French sample over http ---- */
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

    await mp.goto(`${HTTP_APP}?sample`)
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

    /* ---- 10. RECOVERY: a stored snapshot the format refuses is never
       overwritten. The one scenario where doing nothing is the feature: the
       editor stays closed, every write path stays disarmed, and the bytes are
       still there after a reload — until a person decides otherwise. ---- */
    const CORRUPT = '{"version":3,"review":{"title":"Revue du 3 mars"},"was":"a portfolio"}'
    const rescue = await browser.newContext({ locale: 'fr-FR' })
    const rp = await rescue.newPage()
    const rescueErrors = []
    watchErrors(rp, rescueErrors)

    // Seed the corrupt snapshot on the app's own origin, from a blank page:
    // the app itself must never have run before the seed, or its own save
    // would overwrite it on the way out.
    await rp.goto(`${HTTP_ORIGIN}/__seed.html`)
    await rp.evaluate((raw) => localStorage.setItem('project-review/portfolio', raw), CORRUPT)
    await rp.goto(HTTP_APP)
    await settle(rp)

    check(
      await rp.getByRole('heading', { name: 'Sauvegarde locale illisible' }).isVisible(),
      'recovery: an unreadable snapshot opens the recovery screen, not the editor',
    )
    check(
      (await rp.locator('nav').count()) === 0,
      'recovery: the editor is not mounted — no edit can start a save cycle',
    )
    check(
      (await rp.getByRole('button', { name: 'Télécharger la sauvegarde' }).isVisible()) &&
        (await rp.getByRole('button', { name: /Repartir/ }).isVisible()),
      'recovery: both choices are offered — download the backup, or start empty',
    )

    // Wait past the debounce, reload, wait again: the bytes must be untouched.
    await rp.waitForTimeout(1500)
    await rp.reload()
    await settle(rp)
    await rp.waitForTimeout(1500)
    check(
      (await rp.evaluate(() => localStorage.getItem('project-review/portfolio'))) === CORRUPT,
      'recovery: the stored bytes survive the boot, the wait and a reload — byte for byte',
    )

    // The backup comes back VERBATIM, not reformatted.
    const [rescueDownload] = await Promise.all([
      rp.waitForEvent('download'),
      rp.getByRole('button', { name: 'Télécharger la sauvegarde' }).click(),
    ])
    const rescueFile = join(downloads, `rescue-${rescueDownload.suggestedFilename()}`)
    await rescueDownload.saveAs(rescueFile)
    check(
      (await readFile(rescueFile, 'utf8')) === CORRUPT,
      'recovery: the downloaded backup is the stored bytes, unrepaired',
    )

    // The explicit decision, and only it, releases the persistence.
    await rp.getByRole('button', { name: /Repartir/ }).click()
    await settle(rp)
    check((await rp.locator('nav').count()) > 0, 'recovery: « start empty » opens the editor')
    check(
      (await rp.evaluate(() => localStorage.getItem('project-review/portfolio'))) === null,
      'recovery: the abandoned snapshot is erased, not overwritten in place',
    )
    check(
      rescueErrors.length === 0,
      `recovery: zero console errors${rescueErrors.length ? ` — ${rescueErrors[0]}` : ''}`,
    )
    await rescue.close()
  } finally {
    await browser.close()
    server.close()
    await rm(downloads, { recursive: true, force: true })
  }

  if (failures > 0) {
    console.error(`\nsmoke: ${failures} check(s) failed`)
    process.exit(1)
  }
  console.log('\nsmoke: all checks passed')
}

await main()
