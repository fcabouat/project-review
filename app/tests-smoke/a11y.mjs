/**
 * axe checks built editor/site surfaces in light/dark and nine print combinations.
 * Requires build → docs:api → build-storybook → docs:site.
 * Serious/critical findings fail; moderate/minor findings are reported.
 */

import { access } from 'node:fs/promises'
import { serve } from './server.mjs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'

const ROOT = resolve(import.meta.dirname, '../..')
const DIST = join(ROOT, 'dist')
const SITE = join(ROOT, '_site')

let gate = 0
const results = []

/** Runs axe on the CURRENT page state and records the verdict line. */
async function scan(page, surface, mode) {
  const outcome = await new AxeBuilder({ page }).analyze()
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  for (const violation of outcome.violations) {
    byImpact[violation.impact ?? 'minor'] += violation.nodes.length
  }
  const blocking = byImpact.critical + byImpact.serious
  gate += blocking
  results.push({ surface, mode, ...byImpact })
  const detail = outcome.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `\n      ${v.impact}: ${v.id} ×${v.nodes.length} — ${v.nodes[0]?.target}`)
    .join('')
  console.log(
    `  ${blocking === 0 ? 'ok  ' : 'FAIL'} ${surface} [${mode}] — ` +
      `critical ${byImpact.critical} · serious ${byImpact.serious} · ` +
      `moderate ${byImpact.moderate} · minor ${byImpact.minor}${detail}`,
  )
}

async function editorPass(browser, base, mode) {
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1280, height: 860 },
  })
  // The reader scheme is an app-side preference: seed it exactly as the app
  // stores it, so `dark` exercises the real `.dark` token path.
  await context.addInitScript(
    (scheme) => localStorage.setItem('project-review/scheme', scheme),
    mode,
  )
  const page = await context.newPage()
  const app = `${base}/dist/index.html?sample`
  const settle = () => page.waitForTimeout(300)

  for (const [hash, surface] of [
    ['#/review', 'review'],
    ['#/projects', 'projects'],
    ['#/sheet/P-01', 'sheet'],
    ['#/settings', 'settings'],
    ['#/history', 'history'],
    ['#/about', 'about'],
  ]) {
    await page.goto(`${app}${hash}`)
    await page.waitForSelector('.editor')
    await settle()
    await scan(page, surface, mode)
  }

  for (const [label, surface] of [
    ['Importer…', 'import dialog'],
    ['Exporter…', 'export dialog'],
  ]) {
    await page.goto(`${app}#/review`)
    await page.waitForSelector('.editor')
    await settle()
    await page.getByRole('button', { name: label }).click()
    await settle()
    await scan(page, surface, mode)
    await page.keyboard.press('Escape')
  }

  await page.goto(`${app}#/review`)
  await page.waitForSelector('.editor')
  await settle()
  await page.getByRole('button', { name: /Générer le diaporama/ }).click()
  await page.waitForSelector('.reveal.ready', { timeout: 20_000 })
  await settle()
  await scan(page, 'slideshow', mode)

  await context.close()
}

/**
 * The nine theme x palette pairs, printed. One context per pair: the stored
 * envelope decides the pairing, `?print` lays the whole deck flat, and axe
 * reads every page of it in one pass.
 */
async function printPass(browser, base) {
  const sample = JSON.parse(await readFile(join(DIST, 'sample-portfolio.fr.json'), 'utf8'))
  for (const style of ['flat', 'institutional', 'modern']) {
    for (const palette of ['material', 'tailwind', 'uniform']) {
      // The envelope is written by hand, like the smoke run's: this file is
      // plain node over the BUILT deliverable and imports no source. `format`
      // is `STATE_FORMAT` (core's services/persistence.ts).
      const envelope = JSON.stringify({
        format: 1,
        revision: 1,
        portfolio: {
          ...sample,
          settings: { ...sample.settings, theme: { ...sample.settings.theme, style, palette } },
        },
        history: { past: [], future: [] },
      })
      const context = await browser.newContext({
        locale: 'fr-FR',
        viewport: { width: 1280, height: 900 },
      })
      await context.addInitScript(
        (state) => localStorage.setItem('project-review/state', state),
        envelope,
      )
      const page = await context.newPage()
      await page.goto(`${base}/dist/index.html?print`)
      await page.waitForSelector('.rp-print-root .slide', { timeout: 30_000 })
      await page.waitForTimeout(600)
      await scan(page, `print ${style}/${palette}`, 'paper')
      await context.close()
    }
  }
}

/**
 * The recovery screen. It has no route and no way in from the interface: it is
 * what `App.svelte` renders INSTEAD of the editor when the stored envelope
 * cannot be read, so the only way to reach it is to put such an envelope in
 * the storage before the app boots — the same corrupt value the smoke run
 * uses, and the shape that matters: a well-formed envelope whose PORTFOLIO
 * breaks the contract, which is the one that renders the error list.
 */
async function recoveryPass(browser, base, mode) {
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1280, height: 860 },
  })
  await context.addInitScript(
    (scheme) => localStorage.setItem('project-review/scheme', scheme),
    mode,
  )
  await context.addInitScript(
    (raw) => localStorage.setItem('project-review/state', raw),
    '{"format":1,"revision":7,"portfolio":{"version":3,"review":{"title":"Revue du 3 mars"},' +
      '"was":"a portfolio"},"history":{"past":[],"future":[]}}',
  )
  const page = await context.newPage()
  // No `?sample`: an unreadable envelope already counts as an existing base,
  // and the plain URL is what a person would have open.
  await page.goto(`${base}/dist/index.html`)
  await page.waitForSelector('main#main')
  await page.waitForTimeout(300)
  // ASSERT THE SCREEN, DO NOT ASSUME IT. The editor shell carries a `main#main`
  // too: a seed that failed would leave this pass scanning the editor a second
  // time and reporting a green it never earned — the exact shape of hole the
  // boundary probes exist for. `.editor` is the shell this screen REPLACES.
  if ((await page.locator('.editor').count()) > 0) {
    console.error('recovery: the editor is mounted — the unreadable seed did not take')
    process.exit(1)
  }
  await scan(page, 'recovery', mode)
  await context.close()
}

async function landingPass(browser, base, mode) {
  const context = await browser.newContext({
    colorScheme: mode,
    viewport: { width: 1280, height: 860 },
  })
  const page = await context.newPage()
  for (const [path, surface] of [
    ['/_site/index.html', 'landing en'],
    ['/_site/fr.html', 'landing fr'],
  ]) {
    await page.goto(`${base}${path}`)
    await page.waitForTimeout(200)
    await scan(page, surface, mode)
  }
  await context.close()
}

async function main() {
  await access(join(DIST, 'index.html')).catch(() => {
    console.error('Missing dist/index.html — run `pnpm run build` first.')
    process.exit(1)
  })
  await access(join(SITE, 'index.html')).catch(() => {
    console.error('Missing _site/index.html — run `pnpm run docs:site` first.')
    process.exit(1)
  })

  const server = await serve(ROOT)
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ chromiumSandbox: false })

  try {
    for (const mode of ['light', 'dark']) {
      await editorPass(browser, base, mode)
      await recoveryPass(browser, base, mode)
      await landingPass(browser, base, mode)
    }
    await printPass(browser, base)
  } finally {
    await browser.close()
    server.close()
  }

  console.log(`\na11y: ${results.length} scans (surface×mode, plus the nine printed pairs)`)
  if (gate > 0) {
    console.error(`a11y: ${gate} serious/critical violation node(s) — failing`)
    process.exit(1)
  }
  console.log('a11y: zero serious/critical violations')
}

await main()
