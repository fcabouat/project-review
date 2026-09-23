/** Build six read-only decks through the real editor export, and reopen them offline.
 * Requires the app build and Playwright Chromium. No alternate slide renderer. */
import assert from 'node:assert/strict'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { serve } from '../app/tests-smoke/server.mjs'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const out = resolve(dist, 'examples')
await mkdir(out, { recursive: true })
await copyFile(resolve(dist, 'THIRD-PARTY-LICENSES.txt'), resolve(out, 'THIRD-PARTY-LICENSES.txt'))
const server = await serve(dist)
let browser
try {
  browser = await chromium.launch({ chromiumSandbox: false })
  for (const language of ['fr', 'en']) {
    const sample = JSON.parse(
      await readFile(resolve(dist, `sample-portfolio.${language}.json`), 'utf8'),
    )
    assert.equal(sample.settings.language, language)
    for (const [style, palette] of [
      ['flat', 'material'],
      ['institutional', 'uniform'],
      ['modern', 'tailwind'],
    ]) {
      const context = await browser.newContext({
        locale: language,
        viewport: { width: 1280, height: 720 },
        colorScheme: 'light',
      })
      try {
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', (error) => errors.push(String(error)))
        await page.goto(`http://127.0.0.1:${server.address().port}/__seed.html`)
        await page.evaluate(
          (portfolio) =>
            localStorage.setItem(
              'project-review/state',
              JSON.stringify({
                format: 1,
                revision: 1,
                portfolio,
                history: { past: [], future: [] },
              }),
            ),
          {
            ...sample,
            settings: { ...sample.settings, theme: { ...sample.settings.theme, style, palette } },
          },
        )
        await page.goto(`http://127.0.0.1:${server.address().port}/project-review.html#/settings`)
        // Use the actual control, persist, reload: examples also exercise its wiring.
        const linearLabel = language === 'fr' ? 'Linéaire' : 'Linear'
        await page.getByRole('button', { name: linearLabel, exact: true }).click()
        await page.waitForFunction(
          () =>
            JSON.parse(localStorage.getItem('project-review/state')).portfolio.settings
              .navigation === 'linear',
        )
        await page.reload()
        assert.equal(
          await page
            .getByRole('button', { name: linearLabel, exact: true })
            .getAttribute('aria-pressed'),
          'true',
        )
        await page
          .getByRole('button', {
            name: language === 'fr' ? /Générer le diaporama/ : /Generate the slideshow/,
          })
          .click()
        await page.waitForSelector('.reveal.ready')
        assert.equal(await page.locator('.slides > section.slide').count(), 34)
        assert.equal(await page.locator('.slides > section > section').count(), 0)
        await page.mouse.move(640, 4)
        const [download] = await Promise.all([
          page.waitForEvent('download'),
          page
            .getByRole('button', { name: language === 'fr' ? 'Enregistrer' : 'Save', exact: true })
            .click(),
        ])
        const file = resolve(out, `${language}-${style}.html`)
        await download.saveAs(file)
        // Offline and without the editor's storage or locale: the file stands alone.
        const reader = await browser.newContext({
          offline: true,
          viewport: { width: 1280, height: 720 },
        })
        try {
          const deck = await reader.newPage()
          deck.on('pageerror', (error) => errors.push(String(error)))
          await deck.goto(pathToFileURL(file).href)
          await deck.waitForSelector('.reveal.ready')
          assert.equal(await deck.getAttribute('html', 'lang'), language)
          assert.equal(await deck.locator('.slides > section.slide').count(), 34)
          const sections = deck.locator('.slides > section.slide')
          for (let index = 1; index <= 8; index += 1) {
            await deck.keyboard.press('ArrowRight')
            await sections.nth(index).waitFor({ state: 'visible' })
            // Wait for the actual transition to finish: a visible slide can
            // still be partly off canvas, especially on a busy CI runner.
            await deck.waitForFunction((index) => {
              const slide = document.querySelectorAll('.slides > section.slide')[index]
              const bounds = slide.getBoundingClientRect()
              return Math.abs(bounds.left) < 1 && Math.abs(bounds.right - innerWidth) < 1
            }, index)
          }
          const text = await sections.nth(8).innerText()
          assert.ok(
            text.toLowerCase().includes(language === 'fr' ? 'objectif' : 'goal'),
            `${language}-${style}: generated labels`,
          )
          assert.ok(
            text.includes(sample.projects.find((p) => p.reference === 'P-02').goal),
            'sample content matches',
          )
          await deck.screenshot({ path: resolve(out, `${language}-${style}.png`) })
          await deck.keyboard.press('ArrowLeft')
          await sections.nth(7).waitFor({ state: 'visible' })
        } finally {
          await reader.close()
        }
        assert.deepEqual(errors, [])
        console.log(
          `example ${language}-${style}: 34 slides, saved navigation, offline export and keyboard OK`,
        )
      } finally {
        await context.close()
      }
    }
  }
} finally {
  await browser?.close()
  await new Promise((done) => server.close(done))
}
