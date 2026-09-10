# Overview — the application on one page

project-review replaces the slides-plus-spreadsheet combo behind a monthly
project review. A portfolio — projects, categories, decisions, milestones —
is entered once in the editor, and the entire slide deck (dashboards, recap,
project sheets, decisions, archives) is derived from it on demand. The app is
100 % client-side: one HTML file that runs from `file://`, no server, no
account.

This page gives the view and points; every detail lives in the code and its
tests. When this page and the code disagree, the page is wrong.

## Four packages, one-way flow

| Package                   | Role                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `packages/core`           | Pure domain: no DOM, no clock, no storage, zero dependencies — embeddable anywhere                                   |
| `packages/components`     | Svelte views: slides, editor widgets, slideshow host, five pure-props screens                                        |
| `packages/infrastructure` | Browser adapters for the interfaces the core declares (localStorage, scheduler, hash router, fonts, palette, export) |
| `app`                     | The deliverable — wiring only: `src/bindings/` binds core state to runes, `App.svelte` injects and mounts            |

Dependency rule: core imports nothing; components and infrastructure import
only core; the app imports all three. Views render and emit commands, never
mutate; adapters implement, never decide.

## The core's grammar — eight layers

- `values/` — refined scalars: ISO dates, progress, ids (constructors + allocators),
  and the shapes the file format pins for what a portfolio CARRIES (font family
  and face, inline logo, palette colour) — read once, judged identically by the
  strict parse and by the commands the editor emits.
- `model/` — the portfolio and its parts: plain immutable types, closed enumerations.
- `data/` — initialisation data: empty portfolio, fr/en message tables (the sample sets and the JSON schema ship beside the code, in `packages/core/samples/`).
- `commands/` — the use-cases (`Command` union) and their handlers (`decide`: intent → completed event).
- `events/` — the `DomainEvent` union with `apply`/`invert`, plus the bounded event register.
- `projections/` — pure read-models: the deck, the figures, the predicates. Nothing derived is ever stored.
- `services/` — business services: strict parse, persistence policy (with its two injected interfaces), portfolio file, i18n.
- `runtime/` — the editing runtime (`execute`/`undo`/`redo` over `{ past, present, future }`) — the one place `apply` is called.

Lower layers never import upper ones; nothing inside the core imports the
runtime back.

## The loop

Every change is one command. `dispatch(command)` runs `decide`, which
completes the intent against the present portfolio — so every recorded
`before` is true by construction, and an inapplicable or trivial command
yields `undefined`: nothing is recorded. The completed event goes through
`apply` (pure, total, structure-sharing) and enters the log, bounded to the
last 500 events. Undo applies `invert(event)` — computable from the event
alone, no snapshots — and redo replays the same event forward. The seam:
`dispatch` returns the recorded event (or `undefined`), so a view can react
to a refusal; an import is just one command — `ReplacePortfolio`, or
`MergeProjects` in merge mode — undoable like everything else.

## Where the guarantees live

The laws are proven by named tests; the boundaries are enforced twice.

- Inversion, involution, totality, immutability, purity of `invert` —
  `packages/core/tests/events/apply-invert.test.ts`, exhaustive over the
  event union by construction of its fixture.
- Truthful completion and the two refusals of `decide` —
  `packages/core/tests/commands/decide.test.ts`, exhaustive over the command union.
- Bounded, rehydratable history — `packages/core/tests/events/history.test.ts`
  and `packages/core/tests/runtime/editing.test.ts`.
- Id uniqueness (the invariant `apply` trusts) —
  `packages/core/tests/events/ids-invariant.test.ts` (seeded property test).
- Strict import — `packages/core/tests/services/parse/index.test.ts`; the
  published format contract is `packages/core/samples/portfolio.schema.json`.
- Exact derivations — `packages/core/tests/projections/`, acceptance figures
  asserted on both bundled sample sets.
- Boundaries — the workspace manifests (a reverse import cannot resolve) plus
  one `no-restricted-imports` block per layer in `eslint.config.js`, zero
  violations tolerated.

Three cross-cutting laws — no clock (the only reference date is
`review.reviewDate`), total functions (only the import refuses, exhaustively),
nothing derived is stored — are stated in the README and pinned by the same
test files.

## Persistence and import

Storage is injected (`KeyValueStorage`), saving is a debounced opt-out
preference, and the whole policy — keys, version stamp, caps — is core code
tested on in-memory doubles. At startup the snapshot is replayed through the
strict parse; anything refused falls back to an empty portfolio rather than
blocking launch. A refused import replaces nothing; an accepted one either
replaces the portfolio or merges a colleague's projects into it — both a
single undoable event.

## What is guaranteed visually

The Svelte components carry no unit tests by design: the component catalog
(`bun run storybook`, 64 stories) is the visual contract for every slide,
widget and screen, and a Playwright smoke run on the built deliverable
(`bun run smoke`, after a build; CI runs it on every push) covers the wired
app over both transports — `file://` and a static http server: load in both
languages, hash navigation, the language and scheme menus, the derived
slideshow, the standalone export re-opened, and an embedded-font round trip
(a .woff2 picked in Settings, exported, served again from `file://`) — zero
console errors tolerated anywhere.

## Going further

- [User guide](user-guide.md) ([français](user-guide.fr.md)) — what the app
  does, from the user's side.
- `bun run docs:api` — the `@project-review/core` API reference, generated
  from the source headers.
- The test suite itself: each file opens by naming the law or module it pins.
