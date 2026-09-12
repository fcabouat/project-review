/**
 * Built-product regressions over file:// and HTTP: editing, persistence,
 * import/export, slideshow and mobile. Requires `pnpm run build`.
 * Errors fail the run, except optional deployed-font 404s (see watchErrors).
 */

import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { serve } from './server.mjs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
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
    console.error(`Missing ${DIST} — run \`pnpm run build\` first (documented precondition).`)
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
    await page.waitForTimeout(700)
    const frozenState = await page.evaluate(() => localStorage.getItem('project-review/state'))
    await page.keyboard.press('Control+z')
    await settle(page)
    check(
      (await page.evaluate(() => localStorage.getItem('project-review/state'))) === frozenState &&
        (await page.locator('.reveal .slides section.slide').count()) === sections,
      'slideshow: editor undo is inactive behind the snapshot',
    )
    const activeIndex = () =>
      page
        .locator('.reveal section.slide.present')
        .evaluate((el) => [...document.querySelectorAll('.reveal section.slide')].indexOf(el))
    const activeSlide = await activeIndex()
    await page.evaluate(() => window.postMessage(JSON.stringify({ method: 'next' }), '*'))
    await settle(page)
    check(
      (await activeIndex()) === activeSlide,
      'slideshow: unsolicited postMessage navigation is ignored',
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

    /* ---- 10. RECOVERY: a stored document the format refuses is never
       overwritten. The one scenario where doing nothing is the feature: the
       editor stays closed, every write path stays disarmed, and the bytes are
       still there after a reload — until a person decides otherwise. ---- */
    // A well-formed envelope whose PORTFOLIO breaks the contract: format and
    // revision read fine, the strict parse is what refuses — the realistic
    // corruption, and the one that exercises the whole reading path.
    const CORRUPT =
      '{"format":1,"revision":7,"portfolio":{"version":3,"review":{"title":"Revue du 3 mars"},' +
      '"was":"a portfolio"},"history":{"past":[],"future":[]}}'
    const rescue = await browser.newContext({ locale: 'fr-FR' })
    const rp = await rescue.newPage()
    const rescueErrors = []
    watchErrors(rp, rescueErrors)

    // Seed the corrupt envelope on the app's own origin, from a blank page:
    // the app itself must never have run before the seed, or its own save
    // would overwrite it on the way out.
    await rp.goto(`${HTTP_ORIGIN}/__seed.html`)
    await rp.evaluate((raw) => localStorage.setItem('project-review/state', raw), CORRUPT)
    await rp.goto(HTTP_APP)
    await settle(rp)

    check(
      await rp.getByRole('heading', { name: 'Sauvegarde locale illisible' }).isVisible(),
      'recovery: an unreadable stored state opens the recovery screen, not the editor',
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
      (await rp.evaluate(() => localStorage.getItem('project-review/state'))) === CORRUPT,
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
    // Erase-THEN-write is fixed by the unit tests, not by this timing-sensitive
    // run: `app/tests/bindings/persistence-control.test.ts` — "discard() — the
    // explicit decision — erases, then lets writes resume" and "discard() only
    // takes effect once the erasure is confirmed". By the time this check runs
    // the debounced save of the freshly emptied portfolio may already have
    // landed, so the assertion never pins the exact instant — only that the
    // ABANDONED bytes are gone: either nothing, or a fresh empty envelope.
    const afterDiscard = await rp.evaluate(() => localStorage.getItem('project-review/state'))
    const abandonedBytesGone = (() => {
      if (afterDiscard === CORRUPT) return false
      if (afterDiscard === null) return true
      try {
        return JSON.parse(afterDiscard).portfolio.projects.length === 0
      } catch {
        return false
      }
    })()
    check(
      abandonedBytesGone,
      'recovery: the abandoned bytes are gone — nothing, or a fresh envelope, in their place',
    )
    check(
      rescueErrors.length === 0,
      `recovery: zero console errors${rescueErrors.length ? ` — ${rescueErrors[0]}` : ''}`,
    )
    await rescue.close()

    /* ---- 11. TWO TABS, ONE STORAGE: no update is ever lost in silence.
       Both pages live in the SAME browser context, so they share one
       localStorage and the browser delivers `storage` events between them —
       the exact setup in which the second tab used to overwrite the first
       without a word. ---- */
    const tabs = await browser.newContext({ locale: 'fr-FR' })
    const tabA = await tabs.newPage()
    const tabB = await tabs.newPage()
    const tabErrors = []
    watchErrors(tabA, tabErrors)
    watchErrors(tabB, tabErrors)

    const titleField = (page) => page.getByRole('textbox', { name: 'Titre', exact: true })
    /** The save state the shell shows, on whatever screen is open. */
    const savePhase = (page) => page.locator('[data-save-phase]').getAttribute('data-save-phase')
    const storedTitle = (page) =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('project-review/state')).portfolio.review.title,
      )
    /** Types a title and commits it, then waits past the 500 ms debounce. */
    const retitle = async (page, title) => {
      await titleField(page).fill(title)
      await titleField(page).press('Tab')
      await page.waitForTimeout(1200)
    }

    await tabA.goto(`${HTTP_APP}#/review`)
    await settle(tabA)
    await retitle(tabA, 'Revue A')
    check((await savePhase(tabA)) === 'saved', 'two tabs: A saves, and the shell says so')

    // B opens on what A saved. Merely opening it must NOT disturb A: the two
    // hold the same document, and there is nothing to announce.
    await tabB.goto(`${HTTP_APP}#/review`)
    await settle(tabB)
    await tabB.waitForTimeout(1200)
    check(
      (await savePhase(tabA)) === 'saved' && (await savePhase(tabB)) === 'saved',
      'two tabs: opening the second one is not a conflict — they agree',
    )

    // Now B really does save something else.
    await retitle(tabB, 'Revue B')
    check((await storedTitle(tabB)) === 'Revue B', 'two tabs: B stored its own version')
    check(
      (await savePhase(tabA)) === 'conflict',
      'two tabs: A is TOLD as it happens, not at its next deadline',
    )

    // A keeps working. The old failure was exactly here: A's next save would
    // land on top of B's without a word. It now writes NOTHING.
    await retitle(tabA, 'Revue A bis')
    check(
      (await storedTitle(tabA)) === 'Revue B',
      'two tabs: while the conflict stands, A overwrites nothing of B’s',
    )
    check((await savePhase(tabA)) === 'conflict', 'two tabs: and A still says so')

    // The only way out is a person choosing, in the open.
    await tabA.getByRole('button', { name: 'Garder cette version' }).click()
    await settle(tabA)
    check(
      (await storedTitle(tabA)) === 'Revue A bis' && (await savePhase(tabA)) === 'saved',
      'two tabs: « keep this version » is A’s deliberate overwrite, and it lands',
    )

    // Symmetry: it is B's turn to be told rather than to lose its work.
    await tabB.waitForTimeout(500)
    check(
      (await savePhase(tabB)) === 'conflict',
      'two tabs: the warning is symmetric — B hears about A too',
    )

    // The preference is shared exactly like the document: B turns the local
    // save off (a confirmed choice, DataCard.svelte) and A finishes that
    // choice — erasing what it had stored — without losing the document A
    // still shows on screen.
    await tabB.goto(`${HTTP_APP}#/settings`)
    await settle(tabB)
    await tabB.getByRole('switch', { name: 'Sauvegarde locale (localStorage)' }).click()
    await settle(tabB)
    await tabB.getByRole('button', { name: 'Confirmer' }).click()
    await tabA.waitForTimeout(500)
    check(
      (await tabA.evaluate(() => localStorage.getItem('project-review/state'))) === null &&
        (await titleField(tabA).inputValue()) === 'Revue A bis',
      'two tabs: B switching the local save off erases what A had stored — A’s open document stays on screen',
    )

    check(
      tabErrors.length === 0,
      `two tabs: zero console errors${tabErrors.length ? ` — ${tabErrors[0]}` : ''}`,
    )
    await tabs.close()

    /* ---- 12. CLOSING MID-EDIT. A field commits at BLUR, so between the
       keystroke and the blur what was typed exists in the field alone. The
       page can go away right there — and the closing write commits the
       drafts itself before it takes the state, because no effect will get
       another turn. `fill` is exactly that state: it focuses, sets the value
       and fires `input`, and it never blurs. ---- */
    const mid = await browser.newContext({ locale: 'fr-FR' })
    const midPage = await mid.newPage()
    const midErrors = []
    watchErrors(midPage, midErrors)

    await midPage.goto(`${HTTP_APP}?sample#/review`)
    await midPage.waitForTimeout(1200) // past the boot's own save
    check((await savePhase(midPage)) === 'saved', 'mid-edit: the sample boot is saved')

    // The sample carries free slides, which have a « Titre » of their own:
    // the review title is the first one on the screen.
    const midTitle = titleField(midPage).first()
    const TYPED_TITLE = 'Titre tapé sans quitter le champ'
    await midTitle.fill(TYPED_TITLE)
    await midPage.waitForTimeout(1200) // a deadline goes by: nothing is armed
    check(
      (await savePhase(midPage)) === 'pending',
      'mid-edit: the strip says the typing is not recorded — it never says « saved »',
    )
    check(
      (await storedTitle(midPage)) !== TYPED_TITLE,
      'mid-edit: and nothing is in the storage, because no blur has happened',
    )

    // The page goes away: a reload fires 'pagehide' like a close does.
    await midPage.reload()
    await settle(midPage)
    check(
      (await storedTitle(midPage)) === TYPED_TITLE,
      'mid-edit: the draft was committed and written on the way out',
    )
    check(
      (await titleField(midPage).first().inputValue()) === TYPED_TITLE,
      'mid-edit: and it is back in the field after the reload',
    )
    check(
      (await savePhase(midPage)) === 'saved',
      'mid-edit: nothing is waiting any more, so the strip says saved',
    )

    // The milestone rows are NOT FieldTexts — a five-column grid, no room for
    // a label or a counter — and they hold their draft the same way.
    await midPage.goto(`${HTTP_APP}#/sheet/P-01`)
    await settle(midPage)
    // The sheet is in tabs; the milestone table lives on « Jalons & dates ».
    const openMilestones = async () => {
      await midPage.getByRole('tab', { name: 'Jalons & dates' }).click()
      await settle(midPage)
      return midPage.getByRole('textbox', { name: 'Libellé' }).first()
    }
    const milestoneLabel = await openMilestones()
    const TYPED_LABEL = 'Jalon tapé sans quitter la ligne'
    await milestoneLabel.fill(TYPED_LABEL)
    await midPage.waitForTimeout(1200)
    check(
      (await savePhase(midPage)) === 'pending',
      'mid-edit: a milestone row mid-edit is announced too',
    )
    await midPage.reload()
    await settle(midPage)
    check(
      (await (await openMilestones()).inputValue()) === TYPED_LABEL,
      'mid-edit: the milestone label survives the close as well',
    )

    // The two outcome fields form one domain value, in either typing order.
    const openDecisions = async () => {
      await midPage.getByRole('tab', { name: 'Décisions', exact: true }).click()
      return [
        midPage.getByRole('textbox', { name: 'Texte', exact: true }).first(),
        midPage.getByRole('textbox', { name: 'Quand', exact: true }).first(),
      ]
    }
    const taken = () =>
      midPage.evaluate(
        () =>
          JSON.parse(localStorage.getItem('project-review/state')).portfolio.projects[0]
            .decisions[0].taken,
      )
    for (const first of [0, 1]) {
      const fields = await openDecisions()
      for (const field of fields) {
        await field.fill('')
        await field.press('Tab')
      }
      const values = ['Décision conservée à la fermeture', '2026-09-12']
      await fields[first].fill(values[first])
      await fields[first].press('Tab')
      await midPage.waitForTimeout(700) // the clearing event finishes saving first
      check((await savePhase(midPage)) === 'pending', 'outcome: one half remains visibly pending')
      await fields[1 - first].fill(values[1 - first])
      await midPage.reload() // last input stays focused until pagehide
      await settle(midPage)
      const result = await taken()
      check(
        result?.text === values[0] && result?.when === values[1],
        `outcome: both halves survive close, ${first === 0 ? 'text' : 'date'} first`,
      )
    }
    await midPage.goto(`${HTTP_APP}#/review`)
    await settle(midPage)
    const blocks = midPage.getByRole('textbox', { name: /Blocs/ }).first()
    await blocks.fill('Premier bloc\n\nDeuxième bloc\n\nTroisième bloc\n\nQuatrième conservé')
    await midPage.reload()
    await settle(midPage)
    check(
      (await blocks.inputValue()).includes('Quatrième conservé'),
      'free slide: a fourth block survives close and reload',
    )
    check(
      midErrors.length === 0,
      `mid-edit: zero console errors${midErrors.length ? ` — ${midErrors[0]}` : ''}`,
    )
    await mid.close()

    /* ---- 13. AN IMPORT UNDONE INSIDE THE SAVE DELAY. Undoing a whole-
       document replacement puts the previous portfolio BACK — the very object
       that was saved — while moving both stacks. The write armed for the
       imported document must be REPLACED by the undone state's, not left to
       land at its deadline and be announced as saved. ---- */
    const undoCtx = await browser.newContext({ locale: 'fr-FR' })
    const up = await undoCtx.newPage()
    const undoErrors = []
    watchErrors(up, undoErrors)

    const IMPORTED_TITLE = 'Revue importée B'
    const sampleSource = JSON.parse(
      await readFile(join(ROOT, 'dist/sample-portfolio.fr.json'), 'utf8'),
    )
    const importedJson = JSON.stringify({
      ...sampleSource,
      review: { ...sampleSource.review, title: IMPORTED_TITLE },
    })

    await up.goto(`${HTTP_APP}#/review`)
    await settle(up)
    await retitle(up, 'Revue A')
    check((await savePhase(up)) === 'saved', 'undone import: A is saved to start with')

    await up.getByRole('button', { name: 'Importer…' }).click()
    await up.getByRole('textbox', { name: 'JSON à importer' }).fill(importedJson)
    const replaceButton = up.getByRole('button', { name: /Remplacer le portefeuille/ })
    await replaceButton.waitFor({ state: 'visible' })
    const undoButton = up.getByRole('button', { name: 'Annuler', exact: true })
    // The dialog closes on the import itself, so the top bar's undo is the
    // only « Annuler » left — and the two clicks are back to back, well
    // inside the 500 ms the debounce waits.
    await replaceButton.click()
    await undoButton.click()

    await up.waitForTimeout(1200) // past the deadline the import had armed
    check(
      (await storedTitle(up)) === 'Revue A',
      'undone import: the undone document never reached the storage',
    )
    check(
      (await savePhase(up)) === 'saved',
      'undone import: and what IS in there is what the strip says is in there',
    )
    const stacks = await up.evaluate(
      () => JSON.parse(localStorage.getItem('project-review/state')).history,
    )
    check(
      stacks.future.length === 1 &&
        stacks.future[0].type === 'PortfolioReplaced' &&
        !stacks.past.some((event) => event.type === 'PortfolioReplaced') &&
        stacks.past.at(-1)?.type === 'ReviewFieldChanged',
      'undone import: BOTH stacks were saved — the import moved to the redo side, ' +
        'and the edit before it is still on the undo side',
    )

    // Reopened on those very bytes, the import is still one Rétablir away.
    await up.reload()
    await settle(up)
    await up.getByRole('button', { name: 'Rétablir', exact: true }).click()
    await up.waitForTimeout(1200)
    check(
      (await titleField(up).first().inputValue()) === IMPORTED_TITLE,
      'undone import: after the reload the redo replays the import',
    )
    check(
      (await storedTitle(up)) === IMPORTED_TITLE,
      'undone import: and the redo is a change like any other — it is saved',
    )
    check(
      undoErrors.length === 0,
      `undone import: zero console errors${undoErrors.length ? ` — ${undoErrors[0]}` : ''}`,
    )
    await undoCtx.close()

    // A real "unsorted" category and the implicit orphan group must coexist.
    const edgeCtx = await browser.newContext({ locale: 'fr-FR' })
    const edge = await edgeCtx.newPage()
    const edgeErrors = []
    watchErrors(edge, edgeErrors)
    const edgePortfolio = structuredClone(sampleSource)
    edgePortfolio.categories = [
      { ...sampleSource.categories[0], id: 'unsorted', name: 'Groupe nommé' },
      { ...sampleSource.categories[1], id: 'opening', name: 'Catégorie Opening' },
    ]
    edgePortfolio.projects[0].categoryId = 'unsorted'
    edgePortfolio.freeSlides = [
      {
        id: 'edge-slide',
        title: 'Ancre explicite',
        anchor: { type: 'closing' },
        blocks: [['Contenu']],
      },
    ]
    await edge.goto(`${HTTP_ORIGIN}/__seed.html`)
    await edge.evaluate(
      (portfolio) =>
        localStorage.setItem(
          'project-review/state',
          JSON.stringify({ format: 1, revision: 1, portfolio, history: { past: [], future: [] } }),
        ),
      edgePortfolio,
    )
    await edge.goto(`${HTTP_APP}#/projects`)
    await settle(edge)
    check(
      (await edge.getByText('Groupe nommé', { exact: true }).first().isVisible()) &&
        (await edge.getByText('À classer', { exact: true }).first().isVisible()),
      'group keys: named unsorted and orphan groups both render',
    )
    await edge.getByRole('button', { name: 'Exporter…' }).click()
    await settle(edge)
    check(await edge.getByRole('dialog').isVisible(), 'group keys: export dialog mounts too')
    await edge.keyboard.press('Escape')
    await edge.goto(`${HTTP_APP}#/settings`)
    await settle(edge)
    await edge.getByLabel('Ancre', { exact: true }).click()
    await edge.getByRole('option', { name: /avant.*Catégorie Opening/ }).click()
    await edge.waitForTimeout(700)
    const anchor = await edge.evaluate(
      () => JSON.parse(localStorage.getItem('project-review/state')).portfolio.freeSlides[0].anchor,
    )
    check(
      anchor.type === 'beforeCategory' && anchor.categoryId === 'opening',
      'anchor: category id opening stays distinct from the opening position',
    )
    check(edgeErrors.length === 0, `edge forms: zero JS errors ${edgeErrors.join('; ')}`)
    await edgeCtx.close()
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
