/** Built-product checks: selective imports and portable appearance profiles. */
import { readFile } from 'node:fs/promises'

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
async function readSaved(page) {
  await page.locator('[data-save-phase="saved"]').waitFor({ state: 'attached' })
  return page.evaluate(() => JSON.parse(localStorage.getItem('project-review/state')).portfolio)
}
async function openImport(page, data) {
  await page.getByRole('button', { name: 'Importer…', exact: true }).click()
  await page.getByRole('textbox', { name: 'JSON à importer' }).fill(JSON.stringify(data))
}
async function applySelection(page) {
  await page.getByRole('button', { name: /Appliquer la sélection/ }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  return readSaved(page)
}

export async function checkImportSelection(browser, appUrl, check) {
  const sample = JSON.parse(
    await readFile(new URL('../../dist/sample-portfolio.fr.json', import.meta.url), 'utf8'),
  )
  const context = await browser.newContext({ locale: 'fr-FR' })
  try {
    const page = await context.newPage()
    await page.goto(appUrl + '?lang=fr')
    await openImport(page, sample)
    await page.getByRole('radio', { name: 'Remplacer tout le portefeuille', exact: true }).check()
    await page.getByRole('button', { name: /Remplacer le portefeuille/ }).click()
    const before = await readSaved(page)
    const incoming = structuredClone(sample)
    incoming.categories.push({ id: 'nouvelle', name: 'Nouvelle catégorie', color: 'purple' })
    incoming.categories[0].name = 'Catégorie renommée'
    incoming.categories[0].color = 'orange'
    incoming.settings.theme.style = 'modern'
    incoming.settings.identity.org = 'Identité à ne pas importer'
    incoming.projects[0].name = 'Projet à ne pas importer'

    await openImport(page, incoming)
    await page.getByRole('radio', { name: /Panacher/ }).check()
    check(
      await page.getByRole('button', { name: /Appliquer la sélection/ }).isDisabled(),
      'mix: nothing selected implicitly',
    )
    await page.getByRole('checkbox', { name: /Nouvelle catégorie/ }).check()
    const categoriesOnly = await applySelection(page)
    check(
      same(categoriesOnly.projects, before.projects) &&
        same(categoriesOnly.settings, before.settings) &&
        same(categoriesOnly.review, before.review),
      'mix: categories alone preserve projects, settings and review',
    )
    check(
      categoriesOnly.categories.length === before.categories.length + 1,
      'mix: selected category added, unchecked conflict left alone',
    )

    await openImport(page, incoming)
    await page.getByRole('radio', { name: /Panacher/ }).check()
    await page.getByRole('checkbox', { name: /Habillage/ }).check()
    await page.getByRole('checkbox', { name: /Catégorie renommée/ }).check()
    await page
      .getByRole('combobox', { name: 'Action pour Catégorie renommée' })
      .selectOption('replace')
    check(
      await page
        .getByRole('region', { name: 'Récapitulatif avant validation' })
        .getByText(/1 remplacement/)
        .isVisible(),
      'mix: conflict preview precedes confirmation',
    )
    const themed = await applySelection(page)
    check(
      same(themed.projects, before.projects) &&
        same(themed.freeSlides, before.freeSlides) &&
        same(themed.settings.identity, before.settings.identity),
      'mix: theme and categories change no projects, free slides or identity',
    )
    check(
      themed.settings.theme.style === 'modern' &&
        themed.categories.find((c) => c.id === 'poste').color === 'orange' &&
        themed.categories.length === categoriesOnly.categories.length,
      'mix: matching ID replaced in place without duplication',
    )

    await page.getByRole('button', { name: 'Exporter…', exact: true }).click()
    await page.getByRole('checkbox', { name: /profil d’apparence/ }).check()
    const profile = JSON.parse(
      await page.getByRole('textbox', { name: 'Exporter', exact: true }).inputValue(),
    )
    check(
      profile.format === 'project-review-appearance' &&
        !('projects' in profile) &&
        !('review' in profile) &&
        !('freeSlides' in profile),
      'profile export: appearance and categories only',
    )
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Fermer', exact: true })
      .last()
      .click()
    profile.settings.theme.style = 'institutional'
    await openImport(page, profile)
    check(
      await page.getByRole('radio', { name: /Remplacer/ }).isDisabled(),
      'profile: cannot replace portfolio',
    )
    const imported = await applySelection(page)
    check(
      same(imported.projects, themed.projects) &&
        same(imported.freeSlides, themed.freeSlides) &&
        same(imported.review, themed.review) &&
        imported.settings.theme.style === 'institutional',
      'profile import: appearance applied without changing content',
    )
    await page.getByRole('button', { name: 'Annuler', exact: true }).click()
    check(
      same(await readSaved(page), themed),
      'profile: one undo restores the entire previous portfolio',
    )
  } finally {
    await context.close()
  }
}
