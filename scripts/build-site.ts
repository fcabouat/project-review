/**
 * Assembles the GitHub Pages site into _site/: a product landing page, the
 * rendered docs (overview + user guides), the generated API reference, the
 * Storybook build — and the real app served as its own live demo.
 *
 * Everything is copied or rendered from artifacts that other scripts build;
 * this file never rebuilds anything heavy itself.
 */
import { marked } from 'marked'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const OUT = '_site'
const page = (title: string, body: string, depth = 0) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { --accent: #303f9f; --ink: #212121; --muted: #78909c; --rule: #cfd8dc }
  * { box-sizing: border-box }
  body { margin: 0; font: 16px/1.6 Roboto, Inter, system-ui, sans-serif; color: var(--ink) }
  main { max-width: 860px; margin: 0 auto; padding: 32px 24px 64px }
  h1, h2, h3 { line-height: 1.25 } a { color: var(--accent) }
  img { max-width: 100%; height: auto }
  pre { background: #f5f5f5; padding: 12px 16px; overflow-x: auto }
  code { font-size: .92em }
  nav.site { border-bottom: 1px solid var(--rule); padding: 10px 24px; display: flex; gap: 18px;
    flex-wrap: wrap; font-size: 14px; font-weight: 600 }
  nav.site a { text-decoration: none }
</style></head><body>
<nav class="site">
  <a href="${'../'.repeat(depth)}index.html">project-review</a>
  <a href="${'../'.repeat(depth)}overview.html">Overview</a>
  <a href="${'../'.repeat(depth)}guide/en.html">User guide</a>
  <a href="${'../'.repeat(depth)}guide/fr.html">Guide (fr)</a>
  <a href="${'../'.repeat(depth)}api/index.html">API</a>
  <a href="${'../'.repeat(depth)}storybook/index.html">Storybook</a>
</nav>
<main>${body}</main></body></html>`

/** Where each source .md lands in the site — cross-links are rewritten to it. */
const MD_TARGETS: Record<string, string> = {
  'overview.md': 'overview.html',
  'user-guide.md': 'guide/en.html',
  'user-guide.fr.md': 'guide/fr.html',
}

/**
 * Renders one doc page: image paths (markdown AND `<img src>`) and .md
 * cross-links are re-rooted for the page's depth so every link resolves both
 * on GitHub (source tree) and on the site.
 */
const md = (path: string, depth = 0): string => {
  const up = '../'.repeat(depth)
  const source = readFileSync(path, 'utf8')
    .replace(/(\(|src=")(?:\.\.\/)?images\//g, `$1${up}images/`)
    .replace(/\(([\w.-]+\.md)\)/g, (whole, target: string) => {
      const html = MD_TARGETS[target]
      return html === undefined ? whole : `(${up}${html})`
    })
  return marked.parse(source) as string
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'guide'), { recursive: true })

// The real app, served as the live demo — the artifact IS the product.
// ONE multilingual file: the language is auto-detected and switchable in-app.
cpSync('dist/project-review.html', join(OUT, 'demo', 'project-review.html'))
cpSync('docs/api', join(OUT, 'api'), { recursive: true })
cpSync('packages/components/storybook-static', join(OUT, 'storybook'), { recursive: true })
if (existsSync('docs/images')) cpSync('docs/images', join(OUT, 'images'), { recursive: true })

writeFileSync(join(OUT, 'overview.html'), page('project-review — overview', md('docs/overview.md')))
writeFileSync(
  join(OUT, 'guide/en.html'),
  page('project-review — user guide', md('docs/user-guide.md', 1), 1),
)
writeFileSync(
  join(OUT, 'guide/fr.html'),
  page('project-review — guide utilisateur', md('docs/user-guide.fr.md', 1), 1),
)

// Landing: hand-written hero (star-oriented copy lives here, not in a template).
const template = readFileSync('scripts/landing.template.html', 'utf8')
const strings = JSON.parse(readFileSync('scripts/landing.i18n.json', 'utf8')) as Record<
  string,
  Record<string, string>
>
const render = (lang: string) =>
  template.replace(/%([A-Z0-9_]+)%/g, (_, key) => strings[lang][key] ?? `%${key}%`)
writeFileSync(join(OUT, 'index.html'), render('en'))
writeFileSync(join(OUT, 'fr.html'), render('fr'))
console.log('site assembled in _site/')
