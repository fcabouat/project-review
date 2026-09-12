/** Check the assembled site, including deeply nested TypeDoc pages and project subpaths. */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve('_site')
const read = (path) => readFileSync(join(root, path), 'utf8')
function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name)
    return entry.isDirectory() ? htmlFiles(file) : file.endsWith('.html') ? [file] : []
  })
}

test('shared navigation and stylesheet resolve on every documentation page', () => {
  const paths = ['index.html', 'fr.html', 'overview.html', 'guide/en.html', 'guide/fr.html']
  const api = htmlFiles(join(root, 'api'))
  assert.ok(api.length > 1)
  paths.push(...api.map((path) => relative(root, path)))
  for (const path of paths) {
    const html = read(path)
    assert.equal(html.match(/class="pr-site-header"/g)?.length, 1, path)
    if (path.startsWith('api/')) {
      assert.ok(html.includes('class="tsd-page-toolbar" role="navigation"'), path)
    }
    const nav = html.match(/<header class="pr-site-header">[\s\S]*?<\/header>/)?.[0]
    assert.ok(nav, path)
    const css = html.match(/href="([^"]*assets\/site-nav\.css)"/)?.[1]
    assert.ok(css, path)
    for (const href of [css, ...Array.from(nav.matchAll(/href="([^"]+)"/g), (m) => m[1])]) {
      if (href.startsWith('https://github.com/')) continue
      const target = new URL(href, `https://example.test/project-review/${path}`)
      assert.ok(target.pathname.startsWith('/project-review/'), `${path}: ${href}`)
      assert.ok(
        existsSync(join(root, target.pathname.slice('/project-review/'.length))),
        `${path}: ${href}`,
      )
    }
  }
})

test('language selection reflects the current page and links to its actual translation', () => {
  for (const [path, lang, target] of [
    ['index.html', 'en', 'fr.html'],
    ['fr.html', 'fr', 'index.html'],
    ['guide/en.html', 'en', '../guide/fr.html'],
    ['guide/fr.html', 'fr', '../guide/en.html'],
  ]) {
    const html = read(path)
    assert.ok(html.includes(`<html lang="${lang}">`), path)
    assert.ok(html.includes(`<span lang="${lang}" aria-current="true">`), path)
    assert.ok(html.includes(`href="${target}" lang=`), path)
    if (!path.startsWith('guide/')) assert.ok(!/%[A-Z0-9_]+%/.test(html), path)
  }
  for (const path of ['overview.html', 'api/index.html']) {
    assert.ok(read(path).includes('lang="fr" aria-disabled="true"'), path)
  }
  for (const [path, lang] of [
    ['index.html', 'en'],
    ['fr.html', 'fr'],
  ]) {
    for (const surface of ['slide', 'projects']) {
      assert.ok(read(path).includes(`src="images/${lang}-${surface}.png"`))
    }
  }
})
