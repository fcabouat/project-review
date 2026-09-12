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

- [Live demo](https://fcabouat.github.io/project-review/demo/project-review.html?sample&lang=en)
  — a 20-project sample, in French or English.
- [Download the HTML file](https://fcabouat.github.io/project-review/demo/project-review.html)
  — save and double-click. Approximately 1.7 MB, fonts and runtime included.
- [Project site](https://fcabouat.github.io/project-review/) — guides, component
  catalog and API reference.

The app starts empty. Sample portfolios are separate
[English](https://fcabouat.github.io/project-review/demo/sample-portfolio.en.json)
and [French](https://fcabouat.github.io/project-review/demo/sample-portfolio.fr.json)
files; import them like any other portfolio.

### Watch example slides

Ready-to-view, read-only decks — the same 20 projects in three themes, with
34 slides each. No editor setup: use ← → to browse, Esc for the overview.

| Theme / palette         | English                                                                           | Français                                                                         |
| ----------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Flat / Material         | [Watch](https://fcabouat.github.io/project-review/examples/en-flat.html)          | [Voir](https://fcabouat.github.io/project-review/examples/fr-flat.html)          |
| Institutional / Uniform | [Watch](https://fcabouat.github.io/project-review/examples/en-institutional.html) | [Voir](https://fcabouat.github.io/project-review/examples/fr-institutional.html) |
| Modern / Tailwind       | [Watch](https://fcabouat.github.io/project-review/examples/en-modern.html)        | [Voir](https://fcabouat.github.io/project-review/examples/fr-modern.html)        |

Save an HTML deck to view it offline. Keep the accompanying
[third-party licenses](https://fcabouat.github.io/project-review/examples/THIRD-PARTY-LICENSES.txt)
when redistributing it. These examples use linear navigation; the editor also
offers horizontal sections with vertical slides, saved with the portfolio.

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

Use **Node.js 24** and **pnpm 10.34.5**, pinned in `package.json` and CI:

```sh
npm install --global pnpm@10.34.5
pnpm install --frozen-lockfile
pnpm run dev
pnpm run build
```

`dist/index.html` and its assets form the static-hosting build;
`dist/project-review.html` is the single-file editor. Distribute the generated
`dist/THIRD-PARTY-LICENSES.txt` alongside the deliverables.

Before submitting a change:

```sh
pnpm run format:check
pnpm run lint
pnpm run check
pnpm run knip
pnpm run test:coverage
pnpm run build
pnpm run smoke
```

Browser checks need Playwright Chromium (`pnpm exec playwright install chromium`).
For the complete documentation/accessibility pass, build in this order:

```sh
pnpm run docs:api
pnpm run build-storybook
pnpm run docs:examples
pnpm run docs:site
pnpm run a11y
```

Other commands: `pnpm run format` formats source; `pnpm run storybook` opens the
component catalog; `pnpm run audit` checks dependency advisories.
`pnpm run docs:notices` regenerates both notice files, and
`node scripts/build-notices.ts --check` checks their contents and installed versions.
License interpretation remains a manual review, not a scanner guarantee.

### Maintainer release

From a clean `develop`, with the intended version committed in all five
`package.json` files:

```sh
# Once: install GitHub CLI, then authenticate in the browser.
gh auth login --hostname github.com --git-protocol https --scopes workflow

pnpm release --dry-run   # local plan, no network or writes
pnpm release
```

The command targets `fcabouat/project-review`. It pushes an isolated candidate
branch, opens the necessary PRs, prints their URLs and waits for you to choose
**Merge pull request** (not Squash/Rebase). It waits for the exact merged
commit's CI and CodeQL, requires a successful Pages deployment on `main`, then
creates the annotated tag and GitHub release. A final PR synchronizes `main`
back to `develop`; local branches and the tag are fast-forwarded/fetched, and
the candidate branch is removed. Existing PRs, tags and releases are reused
when resuming the same version. Release downloads remain on the project site.

No force push, automatic merge or protection bypass. On failure or interruption,
fix the reported issue and run the command again from the same clean `develop`.
Each wait is bounded to 45 minutes. Do not edit or switch the local checkout
while it runs. Closed/modified PRs, changed remote content and conflicting
versions stop the command instead of guessing. GitHub authentication and any
required approvals remain yours; never paste credentials into source files.

### Optional Bun workflow

pnpm is authoritative: commit only `pnpm-lock.yaml`, and use pnpm for dependency
changes, audits and release validation. Dependabot uses the `npm` ecosystem
to update this pnpm lockfile.

Bun 1.4.0 can alternatively install and run the development scripts; Node.js 24
is still required by the build tooling. In a fresh checkout:

```sh
bun install --linker hoisted --no-save
bun run dev
bun run test
bun run build
```

Bun's secondary workflow uses its hoisted linker; pnpm keeps its isolated layout.
Bun imports the pnpm lockfile when no Bun lockfile exists. Do not keep a local
`bun.lock`/`bun.lockb` across dependency changes (both are ignored by Git).
Prefer separate checkouts for the two installers instead of sharing
`node_modules`. This secondary workflow does not replace the frozen pnpm CI.
A manual `Verify and publish` run also checks it in the separate `bun-compat`
job; that job does not gate Pages publication.

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
- API: `pnpm run docs:api`; visual catalog: `pnpm run storybook`

## License

MIT — see [LICENSE](LICENSE), subject to the third-party notices above.

The MIT license covers the software and the assets distributed with it. Logos,
fonts, data and other content imported by users remain subject to their own
rights and are not licensed under it.

Bundled third-party components are also credited inside **About and licenses**.
Tailwind CSS and Material Design inspire two palettes; `uniform` is generated
in OKLCH. Deployment-specific logos, fonts and palettes are not bundled.
