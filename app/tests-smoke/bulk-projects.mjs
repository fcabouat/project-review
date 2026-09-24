/** Category cards and explicit, visible-only, undoable project batch actions. */
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

export async function checkBulkProjects(browser, appUrl) {
  const sample = JSON.parse(
    await readFile(new URL('../../dist/sample-portfolio.fr.json', import.meta.url), 'utf8'),
  )
  const portfolio = {
    ...sample,
    projects: sample.projects.slice(0, 3).map((project, index) => ({
      ...project,
      name: ['Visible Alpha', 'Hidden Beta', 'Other Gamma'][index],
      categoryId: sample.categories[0].id,
      stage: 'inProgress',
      scopeTags: ['#perimetre-06'],
    })),
  }
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1600, height: 950 },
  })
  context.setDefaultTimeout(15_000)
  try {
    await context.addInitScript((data) => {
      if (!localStorage.getItem('project-review/state')) {
        localStorage.setItem(
          'project-review/state',
          JSON.stringify({
            format: 1,
            revision: 1,
            portfolio: data,
            history: { past: [], future: [] },
          }),
        )
      }
    }, portfolio)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const saved = async () => {
      await page.waitForTimeout(800)
      return page.evaluate(() => JSON.parse(localStorage.getItem('project-review/state')).portfolio)
    }
    const begin = async () => {
      await page.getByRole('button', { name: 'Sélectionner', exact: true }).click()
      await page.getByRole('button', { name: 'Tout sélectionner (visible)', exact: true }).click()
    }
    const apply = async (field, value) => {
      await page.getByRole('combobox', { name: 'Action groupée', exact: true }).selectOption(field)
      await page
        .getByRole('combobox', { name: 'Nouvelle valeur', exact: true })
        .selectOption(value === '' ? { label: 'À classer' } : value)
      await page.getByRole('button', { name: 'Appliquer à la sélection', exact: true }).click()
      return saved()
    }
    const undo = async () => {
      await page.getByRole('button', { name: 'Annuler', exact: true }).click()
      const result = await saved()
      assert.deepEqual(
        result.projects.map((p) => [p.id, p.categoryId, p.stage]),
        portfolio.projects.map((p) => [p.id, p.categoryId, p.stage]),
      )
    }
    await page.goto(appUrl + '?lang=fr#/projects')
    const list = await page.locator('.project-list').boundingBox()
    const card = await page.locator('.category-card').first().boundingBox()
    assert.ok(Math.abs(card.x - list.x) < 2 && Math.abs(card.width - list.width) < 2)
    assert.equal(await page.locator('.row-title').filter({ hasText: '#perimetre-06' }).count(), 3)
    await begin()
    const staged = await apply('stage', 'ready')
    assert.ok(staged.projects.every((project) => project.stage === 'ready'))
    await undo()
    await begin()
    const moved = await apply('categoryId', sample.categories[1].id)
    assert.ok(moved.projects.every((project) => project.categoryId === sample.categories[1].id))
    await undo()
    // Empty category id is valid (Unsorted), not the "Choose…" placeholder.
    await begin()
    const unclassified = await apply('categoryId', '')
    assert.ok(unclassified.projects.every((project) => project.categoryId === ''))
    await undo()
    await begin()
    await page.getByRole('searchbox').fill('Visible Alpha')
    const filtered = await apply('stage', 'ready')
    assert.equal(filtered.projects[0].stage, 'ready')
    assert.equal(filtered.projects[1].stage, 'inProgress')
    assert.equal(filtered.projects[2].stage, 'inProgress')
    await page.getByRole('searchbox').fill('')
    await undo()
    // Search includes the shared scope tags.
    await page.getByRole('searchbox').fill('#perimetre-06')
    assert.equal(await page.locator('.project-row').count(), 3)
    await page.getByRole('searchbox').fill('')
    await begin()
    await page.screenshot({ path: '/tmp/project-review-bulk-desktop.png', fullPage: true })
    for (const width of [1280, 900, 390]) {
      await page.setViewportSize({ width, height: 900 })
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `No list overflow at ${width}px`,
      )
    }
    await page.screenshot({ path: '/tmp/project-review-bulk-mobile.png', fullPage: true })
    await page.goto(appUrl + '?sample&lang=fr#/projects')
    assert.equal(await page.getByRole('button', { name: 'Sélectionner', exact: true }).count(), 0)
    assert.equal(await page.locator('.row-select').count(), 0)
    assert.deepEqual(errors, [])
    console.log(
      '  ok — full-width category cards, scope search, visible-only batches, one-step undo and read-only guard',
    )
  } finally {
    await context.close()
  }
}
