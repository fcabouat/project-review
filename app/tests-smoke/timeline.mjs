import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/** Exercise the actual slide CSS (including theme and print overrides). */
export async function checkTimeline(browser, origin, root) {
  for (const [style, language] of [
    ['institutional', 'fr'],
    ['modern', 'fr'],
    ['flat', 'en'],
  ]) {
    const sample = JSON.parse(
      await readFile(resolve(root, `dist/sample-portfolio.${language}.json`), 'utf8'),
    )
    sample.settings.theme.style = style
    sample.settings.navigation = 'linear'
    sample.projects[0].name = 'Timeline regression'
    sample.projects[0].milestones = [
      '2025-07-31',
      '2025-10-21',
      '2025-10-24',
      '2025-11-24',
      '2026-05-20',
      '2026-05-20',
    ].map((date, i) => ({
      label: `Étape ${i + 1} — validation technique des équipements avant leur mise en service`,
      date: style === 'flat' ? '2026-09-01' : date,
      done: i === 0,
    }))
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    try {
      const page = await context.newPage()
      await page.goto(`${origin}/__seed.html`)
      await page.evaluate(
        (portfolio) =>
          localStorage.setItem(
            'project-review/state',
            JSON.stringify({
              format: 1,
              revision: 1,
              portfolio,
              history: { past: [], future: [] },
            }),
          ),
        sample,
      )
      await page.goto(`${origin}/dist/project-review.html`)
      await page
        .getByRole('button', {
          name: language === 'fr' ? /Générer le diaporama/ : /Generate the slideshow/,
        })
        .click()
      await page.waitForSelector('.reveal.ready')
      const index = await page
        .locator('.slides > section.slide')
        .evaluateAll((slides) => slides.findIndex((s) => s.classList.contains('slide--sheet')))
      assert.ok(index >= 0)
      for (let i = 0; i < index; i += 1) await page.keyboard.press('ArrowRight')
      let slide = page.locator('.slides > section.slide').nth(index)
      await slide.waitFor({ state: 'visible' })
      await page.waitForFunction((index) => {
        const rect = document
          .querySelectorAll('.slides > section.slide')
          [index].getBoundingClientRect()
        return Math.abs(rect.left) < 1 && Math.abs(rect.right - innerWidth) < 1
      }, index)
      for (const media of ['screen', 'print']) {
        if (media === 'print') {
          // The product prints a separate flat deck, not Reveal's print CSS.
          await page.goto(`${origin}/dist/project-review.html?print`)
          slide = page.locator('.rp-print-root .slide--sheet').first()
          await slide.waitFor({ state: 'visible' })
        }
        await page.emulateMedia({ media })
        const issues = await slide.evaluate((element) => {
          const bounds = element.querySelector('.tl').getBoundingClientRect()
          const labels = [...element.querySelectorAll('.tl-labels')].map((label) =>
            label.getBoundingClientRect(),
          )
          const problems = []
          for (const [i, box] of labels.entries()) {
            if (
              box.left < bounds.left - 1 ||
              box.right > bounds.right + 1 ||
              box.top < bounds.top - 1 ||
              box.bottom > bounds.bottom + 1
            )
              problems.push(
                `label ${i} outside timeline: ${JSON.stringify(box.toJSON())} / ${JSON.stringify(bounds.toJSON())}`,
              )
            for (const other of labels.slice(i + 1)) {
              if (
                box.left < other.right &&
                box.right > other.left &&
                box.top < other.bottom &&
                box.bottom > other.top
              )
                problems.push(`label ${i} overlaps`)
            }
          }
          const footer = element.querySelector('.slide-foot').getBoundingClientRect()
          const note = element.querySelector('.tl-note').getBoundingClientRect()
          if (note.bottom > footer.top + 1) problems.push('timeline overlaps footer')
          return problems
        })
        assert.deepEqual(issues, [], `${style}/${media}: readable timeline`)
      }
      assert.equal(await slide.locator('.state--done').count(), 1)
      assert.equal(await slide.locator('.state--overdue').count(), 5)
      assert.match(
        await slide.locator('.timeline-legend').innerText(),
        language === 'fr' ? /Réalisé.*À venir.*En retard/ : /Completed.*Upcoming.*Overdue/,
      )
      console.log(`  ok — ${style}: dense timeline, completion legend, screen and print`)
    } finally {
      await context.close()
    }
  }
}
