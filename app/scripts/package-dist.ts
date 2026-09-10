/**
 * Packaging (run by `bun run build:package`): publishes the single-file build
 * (`dist-single/index.html`) as `dist/project-review.html` at the repo root —
 * ONE multilingual artifact. Both catalogs are compiled in; the language
 * lives in the portfolio (auto-detected on first boot, switchable from the
 * top bar), so one file serves every reader — no per-language variant exists.
 *
 * The deliverable carries NO content: the two sample sets are copied NEXT TO
 * it instead — `?sample` fetches the neighbour of the current language over
 * http (sample-boot.ts), and a person downloads and imports them like any
 * portfolio file.
 */
import { copyFileSync, mkdirSync, rmSync, statSync } from 'node:fs'

const SINGLE = 'dist-single/index.html'
const OUT = '../dist/project-review.html'
const SAMPLES = ['sample-portfolio.en.json', 'sample-portfolio.fr.json']

mkdirSync('../dist', { recursive: true })
copyFileSync(SINGLE, OUT)
rmSync('dist-single', { recursive: true, force: true })
for (const sample of SAMPLES) {
  copyFileSync(`../packages/core/samples/${sample}`, `../dist/${sample}`)
}
console.log(`${OUT}: ${statSync(OUT).size} o (+ ${SAMPLES.join(', ')})`)
