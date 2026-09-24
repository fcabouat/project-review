/** Scope chips use shared suggestions without losing raw, unvalidated drafts. */
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

export async function checkScopeTags(browser, appUrl) {
  const sample = JSON.parse(
    await readFile(new URL('../../dist/sample-portfolio.fr.json', import.meta.url), 'utf8'),
  )
  const portfolio = { ...sample, projects: sample.projects.slice(0, 2) }
  portfolio.projects[0].scopeTags = ['#workstation']
  portfolio.projects[1].scopeTags = ['#shared_tag']
  const id = portfolio.projects[0].id
  const context = await browser.newContext({ locale: 'fr-FR' })
  context.setDefaultTimeout(15_000)
  try {
    await context.addInitScript((p) => {
      if (!localStorage.getItem('project-review/state')) {
        localStorage.setItem(
          'project-review/state',
          JSON.stringify({
            format: 1,
            revision: 1,
            portfolio: p,
            history: { past: [], future: [] },
          }),
        )
      }
    }, portfolio)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const input = page.getByRole('textbox', { name: 'Périmètre (tags)', exact: true })
    const waitTags = async (tags) => {
      await page.waitForFunction(
        ({ projectId, expected }) => {
          const state = JSON.parse(localStorage.getItem('project-review/state'))
          return (
            JSON.stringify(state.portfolio.projects.find((p) => p.id === projectId).scopeTags) ===
            JSON.stringify(expected)
          )
        },
        { projectId: id, expected: tags },
      )
    }
    const waitDraft = async (value) => {
      await page.waitForFunction(
        ({ key, expected }) => {
          const state = JSON.parse(localStorage.getItem('project-review/state'))
          return state.drafts?.some((draft) => draft.key === key && draft.value === expected)
        },
        { key: JSON.stringify(['project', id, 'scopeTags']), expected: value },
      )
    }
    await page.goto(`${appUrl}?lang=fr#/sheet/${encodeURIComponent(id)}`)
    assert.equal(await input.getAttribute('placeholder'), '#tag1, #tag2')
    assert.equal(await page.getByRole('textbox', { name: 'Précisions du périmètre' }).count(), 0)
    const onHold = page.getByRole('switch', { name: 'En attente', exact: true })
    const descriptionId = await onHold.getAttribute('aria-describedby')
    assert.ok(descriptionId, 'on-hold switch has an accessible explanation')
    assert.match(await page.locator(`[id="${descriptionId}"]`).textContent(), /pause/i)
    assert.match(await onHold.locator('..').getAttribute('title'), /pause/i)
    await input.fill('shared')
    await page.getByRole('button', { name: '#shared_tag', exact: true }).click()
    await waitTags(['#workstation', '#shared_tag'])
    assert.equal(await input.inputValue(), '', 'suggestions consume the partial query')

    await input.fill('invalid!tag')
    await waitDraft('invalid!tag')
    await page.reload()
    assert.equal(await input.inputValue(), 'invalid!tag', 'invalid raw text survives a reload')
    await waitTags(['#workstation', '#shared_tag'])

    // Removing a chip changes the field base, but must not discard the pending input.
    await input.focus()
    await page.getByRole('button', { name: /#workstation/ }).click()
    await waitTags(['#shared_tag'])
    assert.equal(await input.inputValue(), 'invalid!tag')
    await waitDraft('invalid!tag')
    await page.reload()
    assert.equal(await input.inputValue(), 'invalid!tag', 'draft follows its updated chip base')

    await input.fill('#Valid-tag_06')
    await input.press('Enter')
    await waitTags(['#shared_tag', '#Valid-tag_06'])
    assert.equal(await input.inputValue(), '')
    await page.goto(`${appUrl}?lang=fr#/projects`)
    const row = page
      .locator('.project-grid')
      .filter({ has: page.locator('.row-title', { hasText: portfolio.projects[0].name }) })
      .first()
    assert.ok((await row.textContent()).includes('#Valid-tag_06'), 'list exposes project scope')
    const pill = row.getByText('#Valid-tag_06', { exact: true })
    assert.equal(
      await pill.evaluate((element) => {
        const style = getComputedStyle(element)
        return Number.parseFloat(style.borderTopWidth) > 0 && style.borderRadius !== '0px'
      }),
      true,
      'list scope tags have a visible pill boundary',
    )
    await page.getByRole('button', { name: /Générer le diaporama/ }).click()
    await page.waitForSelector('.reveal.ready')
    assert.ok(
      (await page.locator('.table--recap').allTextContents()).join('\n').includes('#Valid-tag_06'),
      'summary exposes project scope',
    )
    assert.deepEqual(errors, [])
    console.log(
      '  ok — shared scope tags, suggestion selection, draft recovery and summary rendering',
    )
  } finally {
    await context.close()
  }
  await checkSheetScopeOverflow(browser, appUrl)
}

/** Long, valid scope vocabularies must not push the sheet footer off the canvas. */
async function checkSheetScopeOverflow(browser, appUrl) {
  const sample = JSON.parse(
    await readFile(new URL('../../dist/sample-portfolio.fr.json', import.meta.url), 'utf8'),
  )
  for (const style of ['flat', 'institutional', 'modern']) {
    const portfolio = structuredClone(sample)
    portfolio.settings.theme.style = style
    portfolio.settings.navigation = 'linear'
    portfolio.projects = portfolio.projects.slice(0, 2)
    portfolio.projects[0].scopeTags = Array.from(
      { length: 32 },
      (_, i) => `#${'a'.repeat(60)}_${String(i).padStart(2, '0')}`,
    )
    portfolio.projects[0].scope = 'Texte de périmètre conservé '.repeat(8)
    portfolio.projects[1].scopeTags = ['#extra']
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    context.setDefaultTimeout(15_000)
    try {
      await context.addInitScript((p) => {
        localStorage.setItem(
          'project-review/state',
          JSON.stringify({
            format: 1,
            revision: 1,
            portfolio: p,
            history: { past: [], future: [] },
          }),
        )
      }, portfolio)
      const page = await context.newPage()
      await page.goto(`${appUrl}#/sheet/${encodeURIComponent(portfolio.projects[0].id)}`)
      assert.equal(
        await page.getByRole('button', { name: '#extra', exact: true }).isDisabled(),
        true,
      )
      await page.getByRole('button', { name: /Générer le diaporama/ }).click()
      await page.waitForSelector('.reveal.ready')
      const index = await page
        .locator('.slides > section.slide')
        .evaluateAll((slides) =>
          slides.findIndex((slide) => slide.classList.contains('slide--sheet')),
        )
      assert.ok(index >= 0)
      for (let i = 0; i < index; i++) await page.keyboard.press('ArrowRight')
      const slide = page.locator('.slides > section.slide').nth(index)
      await slide.waitFor({ state: 'visible' })
      await page.waitForTimeout(1200)
      const geometry = await slide.evaluate((element) => {
        const meta = element.querySelector('.sheet-meta,.flat-meta')
        return {
          metaHeight: meta.offsetHeight,
          lineHeight: Number.parseFloat(getComputedStyle(meta).lineHeight),
          bottom: element.getBoundingClientRect().bottom,
          footerBottom: element.querySelector('.slide-foot').getBoundingClientRect().bottom,
          title: meta.title,
        }
      })
      assert.ok(
        geometry.metaHeight <= 2 * geometry.lineHeight + 1,
        `${style}: metadata stays within two lines`,
      )
      assert.ok(
        geometry.footerBottom <= geometry.bottom,
        `${style}: footer stays inside its canvas`,
      )
      for (const tag of portfolio.projects[0].scopeTags) assert.ok(geometry.title.includes(tag))
      assert.ok(geometry.title.includes(portfolio.projects[0].scope))
      console.log(`  ok — ${style}: long scope tags preserve sheet layout and complete tooltip`)
    } finally {
      await context.close()
    }
  }
}
