/** Regression checks for the project's header grid and compact options. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

export async function checkSheetPolish(browser, appUrl) {
  const portfolio = JSON.parse(
    await readFile(new URL('../../dist/sample-portfolio.fr.json', import.meta.url), 'utf8'),
  )
  const project = portfolio.projects[0]
  project.reference = undefined
  project.name = 'Déploiement des équipements et renouvellement du parc pour les équipes locales'
  project.updatedOn = '2026-09-23'
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1600, height: 950 },
  })
  context.setDefaultTimeout(15_000)
  try {
    await context.addInitScript((portfolio) => {
      if (!localStorage.getItem('project-review/state'))
        localStorage.setItem(
          'project-review/state',
          JSON.stringify({ format: 1, revision: 1, portfolio, history: { past: [], future: [] } }),
        )
    }, portfolio)
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${appUrl}?lang=fr#/sheet/${project.id}`)
    await page.getByRole('tab', { name: 'Identité', exact: true }).waitFor()
    await page.getByRole('tab', { name: 'Suivi', exact: true }).waitFor()
    const reference = page.getByRole('textbox', {
      name: 'Référence métier (facultative)',
      exact: true,
    })
    const controls = [
      reference,
      page.getByRole('textbox', { name: 'Nom', exact: true }),
      page.locator('.sheet-header-category [aria-label="Catégorie"]'),
      page.getByRole('button', { name: /Aperçu de la slide/ }),
    ]
    // Exercise a wrapped label even when the current font fits on one line.
    const referenceLabel = page.locator('.sheet-header-field > label > span:first-child').first()
    await referenceLabel.evaluate((label) => {
      label.style.maxWidth = '120px'
    })
    const boxes = await Promise.all(controls.map((control) => control.boundingBox()))
    assert.ok(boxes.every(Boolean))
    assert.ok(
      Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y)) < 2,
      `Header controls must share one row: ${JSON.stringify(boxes)}`,
    )
    const labelHeights = await page
      .locator('.sheet-header-field > label > span:first-child')
      .evaluateAll((labels) =>
        labels.map((label) => {
          const range = document.createRange()
          range.selectNodeContents(label)
          return range.getBoundingClientRect().height
        }),
      )
    assert.ok(labelHeights[0] > labelHeights[1], 'Exercise the wrapped reference label')
    await referenceLabel.evaluate((label) => {
      label.style.maxWidth = ''
    })
    await page.screenshot({ path: '/tmp/project-review-sheet-header.png' })

    await page.getByRole('tab', { name: 'Options', exact: true }).click()
    const mode = page.getByRole('group', { name: 'Affichage de la slide de détail', exact: true })
    assert.deepEqual(await mode.getByRole('button').allTextContents(), [
      'Auto',
      'Toujours',
      'Jamais',
    ])
    const metadata = page
      .locator('details')
      .filter({ has: page.locator('summary', { hasText: 'Métadonnées du projet' }) })
    await metadata.locator('summary').click()
    assert.ok((await metadata.textContent()).includes(project.id))
    assert.ok((await metadata.textContent()).includes('Dernière modification'))
    assert.ok((await metadata.textContent()).includes('23/09/26'))
    for (const width of [1600, 390]) {
      await page.setViewportSize({ width, height: 950 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      assert.ok(await mode.evaluate((element) => element.scrollWidth <= element.clientWidth))
      for (const button of await mode.getByRole('button').all()) assert.ok(await button.isVisible())
    }
    await page.screenshot({ path: '/tmp/project-review-sheet-options-mobile.png', fullPage: true })
    // A host-supplied date belongs to the same undo step as the user's edit.
    const today = await page.evaluate(() => {
      const now = new Date()
      return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('-')
    })
    const name = page.getByRole('textbox', { name: 'Nom', exact: true })
    await name.fill('Projet actualisé')
    await name.press('Tab')
    await page.waitForFunction(
      ({ id, today }) => {
        const state = JSON.parse(localStorage.getItem('project-review/state'))
        return (
          state.portfolio.projects.find((p) => p.id === id)?.updatedOn === today &&
          state.history.past.length === 1
        )
      },
      { id: project.id, today },
    )
    await page.reload()
    assert.equal(await name.inputValue(), 'Projet actualisé')
    await page.getByRole('button', { name: 'Annuler', exact: true }).click()
    await page.waitForFunction(
      ({ id, name, date }) => {
        const state = JSON.parse(localStorage.getItem('project-review/state'))
        const project = state.portfolio.projects.find((p) => p.id === id)
        return (
          project.name === name && project.updatedOn === date && state.history.past.length === 0
        )
      },
      { id: project.id, name: project.name, date: project.updatedOn },
    )
    assert.deepEqual(errors, [])
    console.log('  ok — aligned project header, compact options and inspectable metadata')
  } finally {
    await context.close()
  }
}
