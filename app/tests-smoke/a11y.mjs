/**
 * axe-core accessibility pass over the BUILT deliverables — plain node +
 * Playwright + @axe-core/playwright, a sibling of `smoke.mjs` in the same
 * non-PR CI lane (`bun run a11y`, after `bun run build` and `bun run
 * docs:site`).
 *
 * Perimeter, each in LIGHT and DARK:
 *   - the seven editor surfaces: review, projects, sheet, settings, history,
 *     and the import and export dialogs (dark = the reader preference the app
 *     stores app-side, seeded through localStorage before boot);
 *   - the slideshow (reveal booted on the sample deck — slides stay light by
 *     design, the pass proves it holds);
 *   - the landing page, English and French (dark = the OS preference, which
 *     the landing deliberately ignores — the pass proves it stays readable).
 *
 * Gate: ZERO serious or critical violations anywhere. Minor/moderate findings
 * are listed for the record but do not fail the run.
 */

import { access } from 'node:fs/promises'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'

const ROOT = resolve(import.meta.dirname, '../..')
const DIST = join(ROOT, 'dist')
const SITE = join(ROOT, '_site')

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
}

/** Static file server over the repo root — /dist/… and /_site/… both resolve. */
function serve(root) {
  const server = createServer(async (request, response) => {
    const path = (request.url ?? '/').split('?')[0]
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
    console.error('Missing dist/index.html — run `bun run build` first.')
    process.exit(1)
  })
  await access(join(SITE, 'index.html')).catch(() => {
    console.error('Missing _site/index.html — run `bun run docs:site` first.')
    process.exit(1)
  })

  const server = await serve(ROOT)
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ chromiumSandbox: false })

  try {
    for (const mode of ['light', 'dark']) {
      await editorPass(browser, base, mode)
      await landingPass(browser, base, mode)
    }
  } finally {
    await browser.close()
    server.close()
  }

  console.log(`\na11y: ${results.length} surface×mode scans`)
  if (gate > 0) {
    console.error(`a11y: ${gate} serious/critical violation node(s) — failing`)
    process.exit(1)
  }
  console.log('a11y: zero serious/critical violations')
}

await main()
