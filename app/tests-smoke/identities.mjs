/** Built-product checks for identity-based imports and the revised editor layout. */
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

export async function checkIdentities(browser, appUrl) {
  const sample = JSON.parse(
    await readFile(new URL('../../dist/sample-portfolio.fr.json', import.meta.url), 'utf8'),
  )
  const local = {
    ...sample,
    projects: sample.projects.slice(0, 2).map((p) => ({ ...p, reference: undefined })),
  }
  local.projects[0].lead = 'Porteur visible'
  const incoming = {
    ...sample,
    review: { ...sample.review, title: 'Do not import this review' },
    projects: sample.projects.slice(0, 3).map((p, i) => ({
      ...p,
      id: randomUUID(),
      reference: `P-0${i + 1}`,
      name: `Projet entrant ${i + 1}`,
    })),
  }
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1600, height: 950 },
  })
  try {
    await context.addInitScript((portfolio) => {
      if (!localStorage.getItem('project-review/state'))
        localStorage.setItem(
          'project-review/state',
          JSON.stringify({ format: 1, revision: 1, portfolio, history: { past: [], future: [] } }),
        )
    }, local)
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    const saved = async () => {
      await page.waitForTimeout(800)
      return page.evaluate(() => JSON.parse(localStorage.getItem('project-review/state')).portfolio)
    }
    const open = async (data) => {
      await page.getByRole('button', { name: 'Importer…', exact: true }).click()
      await page.getByRole('textbox', { name: 'JSON à importer' }).fill(JSON.stringify(data))
      const projects = page
        .getByRole('dialog')
        .locator('details')
        .filter({ has: page.locator('summary', { hasText: /^Projets —/ }) })
        .first()
      await projects.locator('summary').first().click()
      await projects.getByRole('checkbox', { name: 'Tout sélectionner', exact: true }).check()
    }
    const apply = async () => {
      await page.getByRole('button', { name: /Appliquer la sélection/ }).click()
      await page.getByRole('dialog').waitFor({ state: 'detached' })
      return saved()
    }
    await page.goto(appUrl + '?lang=fr#/projects')
    await open(incoming)
    let result = await apply()
    assert.equal(result.projects.length, 5)
    assert.deepEqual(result.review, local.review)
    assert.deepEqual(result.settings, local.settings)
    incoming.projects[0].name = 'Modification reçue'
    await open(incoming)
    assert.equal(
      await page.getByRole('button', { name: /Appliquer la sélection/ }).isDisabled(),
      true,
    )
    await page
      .getByRole('combobox', { name: 'Action pour Modification reçue' })
      .selectOption('replace')
    result = await apply()
    assert.equal(result.projects.length, 5)
    assert.equal(
      result.projects.find((p) => p.id === incoming.projects[0].id).name,
      'Modification reçue',
    )
    await open(incoming)
    await page
      .getByRole('combobox', { name: 'Action pour Modification reçue' })
      .selectOption('copy')
    result = await apply()
    assert.equal(result.projects.length, 6)
    assert.equal(new Set(result.projects.map((p) => p.id)).size, 6)
    await page.getByRole('button', { name: 'Annuler', exact: true }).click()
    assert.equal((await saved()).projects.length, 5)
    const row = page
      .locator('.project-grid')
      .filter({ has: page.locator('.row-title', { hasText: local.projects[0].name }) })
      .first()
    const title = await row.locator('.row-title').boundingBox(),
      actions = await row.locator('.row-actions').boundingBox()
    assert.ok(actions.x > title.x + title.width)
    assert.equal(await row.locator('.row-lead').textContent(), 'Porteur visible')
    await page.screenshot({ path: '/tmp/project-review-projects-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.screenshot({ path: '/tmp/project-review-projects-mobile.png', fullPage: true })
    await page.setViewportSize({ width: 1280, height: 900 })
    await row.getByRole('button', { name: local.projects[0].name, exact: true }).click()
    assert.equal(
      await page
        .getByRole('textbox', { name: 'Référence métier (facultative)', exact: true })
        .inputValue(),
      '',
    )
    await page.getByRole('button', { name: /Aperçu de la slide/ }).click()
    await page.waitForTimeout(200)
    const dialog = page.getByRole('dialog'),
      close = await dialog.getByRole('button', { name: 'Fermer', exact: true }).boundingBox()
    const launch = await dialog
      .getByRole('button', { name: /Ouvrir le diaporama ici/ })
      .boundingBox()
    await page.screenshot({ path: '/tmp/project-review-preview.png' })
    assert.ok(
      Math.abs(close.y + close.height / 2 - launch.y - launch.height / 2) < 2,
      JSON.stringify({ close, launch }),
    )
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).click()
    await page.getByRole('tab', { name: 'Jalons & dates' }).click()
    const date = page.getByRole('textbox', { name: 'Début', exact: true })
    assert.equal(await date.getAttribute('autocomplete'), 'off')
    assert.ok(await date.getAttribute('name'))
    assert.equal(
      await page.getByLabel('Calendrier — Début', { exact: true }).getAttribute('type'),
      'date',
    )
    await page.getByLabel('Calendrier — Début', { exact: true }).fill('2026-01-12')
    await page.getByLabel('Calendrier — Début', { exact: true }).press('Tab')
    assert.equal((await saved()).projects[0].start, '2026-01-12')
    await page.getByRole('button', { name: /Générer le diaporama/ }).click()
    await page.waitForSelector('.reveal.ready')
    const text = (await page.locator('.slide').allTextContents()).join('\n')
    for (const project of result.projects) assert.ok(!text.includes(project.id))
    assert.ok(
      (await page.locator('.table--recap').allTextContents())
        .join('\n')
        .includes('Porteur visible'),
    )
    await page.goto(appUrl + '#/projects')
    await page.getByRole('button', { name: /Ajouter un projet/ }).click()
    const created = (await saved()).projects.at(-1)
    assert.match(
      created.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    assert.equal(created.reference, undefined)
    assert.deepEqual(errors, [])
    console.log(
      '  ok — identity imports, independent copies, undo, responsive list, preview and date semantics',
    )
  } finally {
    await context.close()
  }
}

/** Lead and two-line scope labels must fit above the footer, including on paper. */
export async function checkSummaryLeads(browser, appUrl) {
  const original = JSON.parse(
    await readFile(new URL('../../dist/sample-portfolio.fr.json', import.meta.url), 'utf8'),
  )
  for (const style of ['flat', 'institutional', 'modern']) {
    for (const withTags of [false, true]) {
      const portfolio = structuredClone(original)
      portfolio.settings.theme.style = style
      portfolio.settings.navigation = 'linear'
      portfolio.settings.recapRows = 16
      portfolio.projects = portfolio.projects.map((project) => ({
        ...project,
        scopeTags: withTags
          ? [
              '#infrastructure_reseau_region_06',
              '#postes_travail_equipes_territoriales',
              '#securite_reseau_et_applications',
              '#metier_06',
            ]
          : undefined,
      }))
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
      try {
        await context.addInitScript(
          (p) =>
            localStorage.setItem(
              'project-review/state',
              JSON.stringify({
                format: 1,
                revision: 1,
                portfolio: p,
                history: { past: [], future: [] },
              }),
            ),
          portfolio,
        )
        const page = await context.newPage()
        for (const media of ['screen', 'print']) {
          await page.emulateMedia({ media })
          await page.goto(appUrl + (media === 'print' ? '?print' : ''))
          if (media === 'screen') {
            await page.getByRole('button', { name: /Générer le diaporama/ }).click()
            await page.waitForSelector('.reveal.ready')
            const index = await page
              .locator('.slides > section.slide')
              .evaluateAll((slides) => slides.findIndex((s) => s.querySelector('.table--recap')))
            assert.ok(index >= 0)
            for (let i = 0; i < index; i++) await page.keyboard.press('ArrowRight')
            await page.waitForTimeout(1200)
          }
          const table = page
            .locator((media === 'print' ? '.rp-print-root ' : '.slides ') + '.table--recap')
            .first()
          await table.waitFor({ state: 'visible' })
          assert.equal(await table.locator('tbody tr').count(), withTags ? 6 : 10)
          if (withTags) {
            const tagLines = await table.locator('tbody .line-clamp-2').evaluateAll((labels) =>
              labels.map((label) => ({
                lines: label.offsetHeight / Number.parseFloat(getComputedStyle(label).lineHeight),
                text: label.textContent,
              })),
            )
            assert.equal(tagLines.length, 6)
            assert.ok(
              tagLines.every(
                (label) =>
                  label.lines >= 1.9 && label.lines <= 2.1 && label.text.includes('#metier_06'),
              ),
              `${style}/${media}: scope tags must exercise two rendered lines: ${JSON.stringify(tagLines)}`,
            )
          }
          const fits = await table.evaluate(
            (element) =>
              element.getBoundingClientRect().bottom <=
              element.closest('.slide').querySelector('.slide-foot').getBoundingClientRect().top -
                4,
          )
          if (!fits) {
            console.log(
              await table.evaluate((element) => ({
                table: element.getBoundingClientRect().toJSON(),
                footer: element
                  .closest('.slide')
                  .querySelector('.slide-foot')
                  .getBoundingClientRect()
                  .toJSON(),
                rows: Array.from(element.querySelectorAll('tbody tr'), (row) => ({
                  height: row.getBoundingClientRect().height,
                  text: row.querySelector('td').textContent,
                })),
              })),
            )
            await page.screenshot({
              path: `/tmp/project-review-summary-${style}-${media}.png`,
              fullPage: true,
            })
          }
          assert.ok(
            fits,
            `${style}/${media}/${withTags ? 'tags' : 'leads'}: summary must leave room for the footer`,
          )
        }
        console.log(
          `  ok — ${style}: summary ${withTags ? 'leads + two-line scope tags' : 'leads'} fit on screen and paper`,
        )
      } finally {
        await context.close()
      }
    }
  }
}
