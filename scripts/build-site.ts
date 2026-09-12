/**
 * Assembles the GitHub Pages site into _site/: a product landing page, the
 * rendered docs (overview + user guides), the generated API reference, the
 * Storybook build — and the real app served as its own live demo.
 *
 * Everything is copied or rendered from artifacts that other scripts build;
 * this file never rebuilds anything heavy itself.
 */
import { marked } from 'marked'
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs'
import { join, relative, sep } from 'node:path'
import { siteNav } from './site-nav.ts'

const OUT = '_site'
const page = (
  title: string,
  body: string,
  lang: 'en' | 'fr',
  section: 'overview' | 'guide',
  depth = 0,
) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="${'../'.repeat(depth)}assets/site-nav.css">
<style>
  :root { --accent: #303f9f; --ink: #212121; --muted: #78909c; --rule: #cfd8dc }
  * { box-sizing: border-box }
  body { margin: 0; font: 16px/1.6 Roboto, Inter, system-ui, sans-serif; color: var(--ink) }
  main { max-width: 860px; margin: 0 auto; padding: 32px 24px 64px }
  h1, h2, h3 { line-height: 1.25 } a { color: var(--accent) }
  img { max-width: 100%; height: auto }
  pre { background: #f5f5f5; padding: 12px 16px; overflow-x: auto }
  code { font-size: .92em }
</style></head><body>
${siteNav(lang, section, depth)}
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
mkdirSync(join(OUT, 'assets'), { recursive: true })
cpSync('scripts/site-nav.css', join(OUT, 'assets/site-nav.css'))

// The real app, served as the live demo — the artifact IS the product.
// ONE multilingual file: the language is auto-detected and switchable in-app.
// The sample sets sit NEXT TO it: `?sample` fetches the one of the current
// language (sample-boot.ts), and the landing links them for download.
cpSync('dist/project-review.html', join(OUT, 'demo', 'project-review.html'))
cpSync('dist/sample-portfolio.en.json', join(OUT, 'demo', 'sample-portfolio.en.json'))
cpSync('dist/sample-portfolio.fr.json', join(OUT, 'demo', 'sample-portfolio.fr.json'))
// The About screen names this file as travelling beside the deliverable;
// `docs:notices` writes it into dist/, and the site serves the app from
// demo/, so it travels along.
cpSync('dist/THIRD-PARTY-LICENSES.txt', join(OUT, 'demo', 'THIRD-PARTY-LICENSES.txt'))
cpSync('dist/examples', join(OUT, 'examples'), { recursive: true })
cpSync('docs/api', join(OUT, 'api'), { recursive: true })
// Decorate the generated copy only. TypeDoc retains its search, menu and anchors.
function decorateApi(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name)
    if (entry.isDirectory()) decorateApi(file)
    else if (entry.name.endsWith('.html')) {
      const depth = relative(OUT, file).split(sep).length - 1
      const source = readFileSync(file, 'utf8')
      if (!source.includes('</head>') || !/<body\b[^>]*>/.test(source)) {
        throw new Error(`Cannot add site navigation to ${file}`)
      }
      writeFileSync(
        file,
        source
          .replace(
            '</head>',
            `<link rel="stylesheet" href="${'../'.repeat(depth)}assets/site-nav.css"></head>`,
          )
          .replace(/<body\b[^>]*>/, (body) => body + siteNav('en', 'api', depth))
          // The site header is the banner; TypeDoc's toolbar is secondary navigation.
          .replace(
            '<header class="tsd-page-toolbar">',
            '<header class="tsd-page-toolbar" role="navigation" aria-label="API navigation">',
          ),
      )
    }
  }
}
decorateApi(join(OUT, 'api'))
cpSync('packages/components/storybook-static', join(OUT, 'storybook'), { recursive: true })
if (existsSync('docs/images')) cpSync('docs/images', join(OUT, 'images'), { recursive: true })

writeFileSync(
  join(OUT, 'overview.html'),
  page('project-review — overview', md('docs/overview.md'), 'en', 'overview'),
)
writeFileSync(
  join(OUT, 'guide/en.html'),
  page('project-review — user guide', md('docs/user-guide.md', 1), 'en', 'guide', 1),
)
writeFileSync(
  join(OUT, 'guide/fr.html'),
  page('project-review — guide utilisateur', md('docs/user-guide.fr.md', 1), 'fr', 'guide', 1),
)

// Landing: hand-written hero (star-oriented copy lives here, not in a template).
const template = readFileSync('scripts/landing.template.html', 'utf8')
const strings = JSON.parse(readFileSync('scripts/landing.i18n.json', 'utf8')) as Record<
  string,
  Record<string, string>
>
const render = (lang: 'en' | 'fr') =>
  template.replace(/%([A-Z0-9_]+)%/g, (_, key) =>
    key === 'SITE_NAV' ? siteNav(lang, 'home') : (strings[lang][key] ?? `%${key}%`),
  )
writeFileSync(join(OUT, 'index.html'), render('en'))
writeFileSync(join(OUT, 'fr.html'), render('fr'))
console.log('site assembled in _site/')
