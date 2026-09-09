/**
 * Packaging (run by `bun run build:package`): publishes the single-file build
 * (`dist-single/index.html`) as `dist/project-review.html` — ONE multilingual
 * artifact. Both catalogs and both sample sets are compiled in; the language
 * lives in the portfolio (auto-detected on first boot, switchable from the
 * top bar), so one file serves every reader — no per-language variant exists.
 */
import { copyFileSync, mkdirSync, rmSync, statSync } from 'node:fs'

const SINGLE = 'dist-single/index.html'
const OUT = 'dist/project-review.html'

mkdirSync('dist', { recursive: true })
copyFileSync(SINGLE, OUT)
rmSync('dist-single', { recursive: true, force: true })
console.log(`${OUT}: ${statSync(OUT).size} o`)
