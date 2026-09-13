# Architecture overview

project-review is an offline portfolio editor and derived slide deck. The
portfolio is the source of truth; dashboards, counts and slide trees are rebuilt
from it, never persisted as competing copies.

## Package boundaries

```text
                  app
                 /   \
        components   infrastructure
                 \   /
                  core
```

| Package          | Responsibility                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `core`           | Domain types, commands, reversible events, projections and persistence policy; no framework, DOM, clock or runtime dependencies |
| `components`     | Svelte rendering, interaction and local input drafts; typed props and callbacks                                                 |
| `infrastructure` | Browser effects: storage, scheduler, routes, fonts, file picking and export                                                     |
| `app`            | Reactive bindings and injection of adapters into the domain/UI contracts                                                        |

ESLint checks package and internal layer boundaries. Core may import its own
modules; “zero dependencies” means no external runtime package, not zero imports.
Views submit intents rather than mutating the portfolio; adapters execute effects
rather than choose domain outcomes.

## Core modules

- `values/`: refined dates, progress, identifiers and portable asset values.
- `model/`: immutable records, closed variants and runtime shape checks.
- `data/`: initial data and translation catalogs.
- `events/`: completed changes, application/inversion and bounded history.
- `commands/`: intent validation and completion into events.
- `projections/`: derived figures, lists, pagination and deck trees.
- `services/`: strict parsing, file and persistence contracts, localization.
- `runtime/`: composition of commands, events and history for editing.

This is a dependency graph, not a linear eight-step pipeline. For example,
commands use events; projections read the model; persistence checks replayable
history using events. Runtime composes them and is not imported back by core.

## Editing and contracts

`execute` decides an intent against the present portfolio, applies its event
and records it. Invalid, inapplicable and no-effect intents are refused without
recording anything. Undo applies the inverse event; redo reapplies the event.
`ReplacePortfolio` and `MergeProjects` follow the same path.

The log holds at most 500 entries and has a separate memory budget.
Replacement events carry before/after portfolios; ordinary edits carry their
own deltas. This is CQRS-lite with bounded undo, not durable event sourcing.
No wall clock enters the model: date-sensitive projections use the review date.

A total function can return a refusal. Strict import accumulates format errors;
commands and persistence also return explicit verdicts. Typed in-process values
and runtime checks protect different boundaries. Import and runtime share shape
rules; the published JSON schema documents the portable format.

Identifiers preserve valid Unicode, but reject unpaired surrogates. Font faces
are unique by normalized weight/style. Text enrichment is deliberately small:
`**bold**` and a final ` — suffix`; excessive markup renders literally instead
of expanding into an unbounded number of DOM elements. The source text is kept.

## Persistence

`services/persistence-session` owns activation, recovery, conflicts and save
decisions. The application binds its notifications to Svelte and supplies the
document, draft registry, storage and scheduler.

One envelope stores `{ format, revision, portfolio, history, drafts }` in one write.
Unreadable storage is never overwritten before an explicit recovery decision.
Writes compare the expected stamp of stored bytes; conflicts ask whether to
take the stored document or keep the open one. This is optimistic detection,
not a lock: localStorage has no atomic compare-and-swap across tabs.

The shared opt-out preference stops subsequent writes. Storage operations report
failure instead of claiming success. Raw input is checkpointed after 1.5 seconds
idle, or 10 seconds of continuous typing, without adding undo events. A hidden
page checkpoints too; pagehide additionally commits complete valid input.
Timers and lifecycle signals are best-effort, not crash-proof guarantees.
Drafts carry stable field keys and original values; matching fields recover them
on mounting; imports and structural changes discard obsolete drafts. Undo/redo
resyncs affected fields without discarding unrelated drafts. Invalid input
stays outside the domain model. The save strip distinguishes pending, saved
drafts and saved document; refused writes offer a separate raw-draft download.
Keep JSON backups independently of browser storage.

## Verification

- Core tests cover reversible events, command contracts, import, history,
  persistence and projections; seeded property tests check identity invariants.
- TypeScript checks closed catalog keys and model-field coverage.
- Component helper tests cover pure formatting and draft assembly; Storybook
  covers visual states, including storage failures that need injected adapters.
- `smoke` exercises the built application over HTTP and `file://`, including
  editing, recovery, undo, conflicts, mobile dialogs and exported decks.
- `a11y` checks the built editor, site and printed style/palette combinations.
  Its gate rejects serious/critical axe findings; manual keyboard, contrast and
  print review remain necessary, especially for custom content and gradients.

The slideshow uses a coherent document snapshot. Aggregate tables paginate and
summary overflow is counted explicitly. Free-form text can still exceed a fixed
slide's visual capacity: previewing the actual output remains part of publication.

See [README](../README.md) for the reproducible build/check order and
[user guide](user-guide.md) ([français](user-guide.fr.md)) for product usage.
