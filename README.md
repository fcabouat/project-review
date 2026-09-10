# project-review

**A complete project-portfolio review app in a single HTML file — no server,
no install, works from `file://`.**

[![CI](https://github.com/fcabouat/project-review/actions/workflows/ci.yml/badge.svg)](https://github.com/fcabouat/project-review/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A portfolio — projects, categories, decisions, milestones — is entered once in
the editor; the entire monthly deck (dashboards, recap table, project sheets,
decisions, archives) is derived from it and regenerated on demand. No slide is
ever edited by hand.

<img src="docs/images/en-slide.png" width="720" alt="A derived project sheet slide in the flat style">

## Try it

- **[Live demo](https://fcabouat.github.io/project-review/demo/project-review.html?sample)** —
  opens on a 20-project sample; switch French/English from the top bar.
- **[Download `project-review.html`](https://fcabouat.github.io/project-review/demo/project-review.html)** —
  download → double-click → it works. One file, ~1.7 MB, everything inlined;
  it runs offline, from a USB stick, or as an email attachment. The app
  itself carries no content: two sample portfolios sit next to it
  ([English](https://fcabouat.github.io/project-review/demo/sample-portfolio.en.json),
  [French](https://fcabouat.github.io/project-review/demo/sample-portfolio.fr.json)) —
  import one like any portfolio file.
- **[Project site](https://fcabouat.github.io/project-review/)** — demo,
  docs, component catalog and API reference in one place.

## Highlights

- **Single file, local-first** — 100 % client-side, runs from `file://`; the
  data never leaves the browser (localStorage persistence, opt-out).
- **Event-sourced editing** — every change is an invertible domain event;
  undo/redo across the last 500 actions, with a business-worded history view.
- **Multi-user without a server** — colleagues edit their own projects in
  their own copy (a partial export opens alone in the app); merging their
  contribution back is one undoable import.
- **A pure, zero-dependency core** — the domain, its commands and its laws are
  plain TypeScript with no runtime dependency, tested to 100 % line coverage.
- **Four packages, one-way flow** — boundaries enforced twice: by the
  workspace manifests (a reverse import cannot resolve) and by per-layer
  ESLint restrictions.
- **Bilingual by construction** — French or English auto-detected on first
  launch, switchable live from the top bar; entered content is never
  translated.
- **Works on a phone** — below desktop widths the sidebar becomes a drawer,
  forms stack and wide tables scroll inside their own frame; the slideshow
  scales to the screen with a touch-visible exit bar.
- **Accessibility as a target** — WCAG 2.1 AA aimed for and checked by an
  axe-core pass (zero serious/critical across every screen, both schemes) and
  a scripted keyboard walk; motion honours `prefers-reduced-motion`. The
  editor holds AA text contrast, and the slides' semantic inks (labels,
  health and risk scales, both themes) were measured and brought to AA text
  contrast; the category-tinted accents (id chips, divider text) remain
  below 4.5:1 by design. No formal RGAA audit.
- **Light and dark editor** — System/Light/Dark reader preference, stored on
  the device, never in the portfolio file; the slides are the artifact and
  stay light in both schemes.
- **Print-perfect A4** — the deck prints one page per slide through the
  browser's dialog; PDF is a print, not an export pipeline.
- **Visual contract** — 64 Storybook stories covering every slide, widget and
  screen, including a fully playable in-memory editor.

## Architecture

```
            ┌───────────────────────────────┐
            │              app              │  wiring only: core state bound
            └───────┬───────────────┬───────┘  to runes, adapters injected
                    │               │
     ┌──────────────▼───┐   ┌───────▼──────────┐
     │    components    │   │  infrastructure  │  Svelte views · browser
     └──────────────┬───┘   └───────┬──────────┘  adapters (storage, router…)
                    │               │
            ┌───────▼───────────────▼───────┐
            │             core              │  pure domain — zero dependency,
            └───────────────────────────────┘  no DOM, no clock, embeddable
```

Views render and emit commands, never mutate; adapters implement, never
decide. Inside the core, eight layers stack one way:

`values → model → data → commands → events → projections → services → runtime`

Three laws hold everywhere: **no clock** (the only reference date is the
review date), **total functions** (no domain function throws — the strict
import is the one gate that refuses, exhaustively), **nothing derived is
stored** (the store holds `{ past, present, future }` and nothing else). Each
law is pinned by named tests.

The whole design fits on one page: **[docs/overview.md](docs/overview.md)**.

## Quick start (from source)

```sh
bun install
bun run dev      # editor on the Vite dev server
bun run build    # all deliverables into dist/
```

| Artifact                                 | Contents                                            |
| ---------------------------------------- | --------------------------------------------------- |
| `dist/index.html` + `assets/` + `fonts/` | Static-hosting build (module scripts, lazy chunks)  |
| `dist/project-review.html`               | The deliverable: one multilingual single-file build |

| Script              | Does                                               |
| ------------------- | -------------------------------------------------- |
| `bun run dev`       | Vite dev server                                    |
| `bun run test`      | Vitest suite (four projects)                       |
| `bun run smoke`     | Playwright smoke, `file://` + http (after a build) |
| `bun run a11y`      | axe-core pass on the built deliverables            |
| `bun run check`     | svelte-check + tsc, per package                    |
| `bun run lint`      | ESLint (incl. boundary rules)                      |
| `bun run format`    | Prettier, write mode                               |
| `bun run knip`      | Unused files/exports/dependencies                  |
| `bun run audit`     | Dependency vulnerability audit                     |
| `bun run docs:api`  | TypeDoc API reference                              |
| `bun run docs:site` | Assemble the GitHub Pages site                     |
| `bun run build`     | Static build + single file                         |
| `bun run storybook` | Component catalog on port 6006                     |

## Contributing

Two contributions are deliberately cheap:

**Add a display language (~20 minutes).** English is the language of code and
format; a display language is data:

1. `packages/core/src/model/theme.ts` — extend the `Language` union and
   `LANGUAGES`.
2. `packages/core/src/data/catalog.<lang>.ts` — the generated-labels table
   (copy `catalog.en.ts`; `services/i18n.ts` pins all key sets together at
   compile time with `CoversExactly`).
3. `packages/components/src/i18n.ts` — the editor-chrome catalog (same keys,
   one more column).
4. `packages/core/samples/sample-portfolio.<lang>.json` — a sample set, validated
   by the strict parse and the acceptance tests.
5. `docs/user-guide.<lang>.md` — the guide.

**Add a color palette (~10 minutes).** A palette is one CSS block:

1. `packages/components/src/palettes.css` — add a `[data-palette='<name>']`
   block mapping the 12 generic category colors to hex values.
2. `packages/core/src/model/theme.ts` — extend the `PaletteFamily` union and
   `PALETTES`.
3. `packages/components/src/i18n.ts` — one `editor.palette.<name>` label.

**Add a slide theme (~1–2 hours).** A theme RESTYLES the slides — colors,
borders, shadows, typography accents — and never changes their structure:
the layout belongs to the templates' utility classes, which stay untouched.
The pattern is proven by `flat`:

1. `packages/components/src/slides/flat.css` — copy it to `<name>.css` and
   restyle under `[data-slide-style='<name>']`. The swap works because these
   theme rules are UNLAYERED and therefore outrank the templates' layered
   Tailwind utilities — keep every rule scoped under the attribute.
2. Follow `flat`'s print pattern for the `print:` context, so the A4 pages
   restyle with the screen.
3. `packages/core/src/model/theme.ts` — extend the `ThemeStyle` union and
   `THEME_STYLES`.
4. `packages/components/src/i18n.ts` — one `editor.style.<name>` label.

Before opening a PR, read [docs/overview.md](docs/overview.md) — the
architecture, the three laws and where the guarantees live — and run
`bun run test && bun run check && bun run lint`.

## Documentation

- [docs/overview.md](docs/overview.md) — the application on one page:
  packages, core layers, the edit loop, where the guarantees live
- [User guide](docs/user-guide.md) · [Guide utilisateur](docs/user-guide.fr.md)
- [portfolio.schema.json](packages/core/samples/portfolio.schema.json) — the
  published contract of the portfolio file format
- `bun run docs:api` — `@project-review/core` API reference into `docs/api/`
- `bun run storybook` — component catalog

## License

MIT — see [LICENSE](LICENSE).

The `gov` palette and the institutional theme's look are inspired by the French
State's design system (DSFR — its illustrative palette), and the Marianne
font can be deployed alongside the app; this tool is not affiliated with or
endorsed by the French State.
