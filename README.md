# project-review

A project-portfolio review app in one HTML file: no server, no installation,
works offline from `file://`.

[![CI](https://github.com/fcabouat/project-review/actions/workflows/ci.yml/badge.svg)](https://github.com/fcabouat/project-review/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Enter projects, categories, decisions and milestones once; generate dashboards,
recaps, project sheets and archives from that portfolio. Optional free slides
carry your own narrative.

<img src="docs/images/en-slide.png" width="720" alt="A derived project sheet slide in the flat style">

## Try it

- [Live demo](https://fcabouat.github.io/project-review/demo/project-review.html?sample)
  — a 20-project sample, in French or English.
- [Download the HTML file](https://fcabouat.github.io/project-review/demo/project-review.html)
  — save and double-click. Approximately 1.7 MB, fonts and runtime included.
- [Project site](https://fcabouat.github.io/project-review/) — guides, component
  catalog and API reference.

The app starts empty. Sample portfolios are separate
[English](https://fcabouat.github.io/project-review/demo/sample-portfolio.en.json)
and [French](https://fcabouat.github.io/project-review/demo/sample-portfolio.fr.json)
files; import them like any other portfolio.

## Features and limits

- Local-first editing with opt-out browser storage, explicit save/conflict
  status and JSON backups. Browser storage is not a substitute for backups.
- Undo/redo: up to 500 actions, additionally bounded by the history byte budget.
  Imports and merges are undoable; this is a bounded editing log, not an audit trail.
- Colleagues can exchange partial exports and merge projects without a server.
- French and English interface; user-entered content is never translated.
- Three slide styles and three palettes. A portfolio can carry its own logo,
  font faces and twelve-color palette; device preferences stay outside it.
- Responsive editor, light/dark schemes and a scaled, touch-navigable slideshow.
- A4 landscape printing and standalone HTML deck export. Long aggregate tables
  paginate; dense free-form content still needs a preview before distribution.
- Accessibility target: WCAG 2.1 AA. Automated axe and keyboard checks complement
  Storybook; they do not constitute an RGAA audit or certify imported colors/content.

## Architecture

Four packages: a framework-free TypeScript core, Svelte components, browser
adapters, and an application that wires them together. Components and
infrastructure depend on core, not on each other. ESLint enforces the boundaries.

Commands validate intent; events carry reversible changes; projections derive
the views. External data crosses a strict import contract before entering the
model. See [the architecture overview](docs/overview.md) for the actual dependency
graph, persistence guarantees and limits.

## Build and verify

Use **Bun 1.4.0**, pinned in `package.json` and CI:

```sh
bun install --frozen-lockfile
bun run dev
bun run build
```

`dist/index.html` and its assets form the static-hosting build;
`dist/project-review.html` is the single-file editor. Distribute the generated
`dist/THIRD-PARTY-LICENSES.txt` alongside the deliverables.

Before submitting a change:

```sh
bun run format:check
bun run lint
bun run check
bun run knip
bun run test:coverage
bun run build
bun run smoke
```

Browser checks need Playwright Chromium (`bunx playwright install chromium`).
For the complete documentation/accessibility pass, build in this order:

```sh
bun run docs:api
bun run build-storybook
bun run docs:site
bun run a11y
```

Other commands: `bun run format` formats source; `bun run storybook` opens the
component catalog; `bun run audit` checks dependency advisories.
`bun run docs:notices` regenerates both notice files, and
`bun scripts/build-notices.ts --check` checks their contents and installed versions.
License interpretation remains a manual review, not a scanner guarantee.

## Contributing

Target `develop` for contributions; `main` holds releases (Gitflow).
The `Verify and publish` workflow validates both branches. Pages deployment is
opt-in (`PAGES_ENABLED=true`) and restricted to `main`, after verification.

Keep domain decisions in core, rendering in components and effects in adapters.
Add regression coverage at the boundary where the bug occurs; do not duplicate
the same scenario across every layer.

- A language needs the model enumeration, matching core/editor catalog entries,
  a sample and a guide. Typed catalogs detect missing keys.
- A palette needs tokens, the model/schema enumeration, its editor label and a
  Storybook toolbar entry. Check text contrast, including category tints.
- A slide style needs a scoped stylesheet, imports alongside the existing styles,
  model/schema entries and a Storybook entry. Prefer restyling existing markup.
  Verify all slide kinds on screen and in print, across the bundled palettes.

## Documentation

- [Architecture](docs/overview.md)
- [User guide](docs/user-guide.md) · [Guide utilisateur](docs/user-guide.fr.md)
- [JSON format schema](packages/core/samples/portfolio.schema.json)
- [Third-party notices](THIRD-PARTY.md)
- API: `bun run docs:api`; visual catalog: `bun run storybook`

## License

MIT — see [LICENSE](LICENSE), subject to the third-party notices above.

The MIT license covers the software and the assets distributed with it. Logos,
fonts, data and other content imported by users remain subject to their own
rights and are not licensed under it.

Bundled third-party components are also credited inside **About and licenses**.
Tailwind CSS and Material Design inspire two palettes; `uniform` is generated
in OKLCH. Deployment-specific logos, fonts and palettes are not bundled.
