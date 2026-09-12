/**
 * THE TWO BUDGETS, STATED ONCE. A portfolio has two ceilings, they answer two
 * different questions, and before this module they were written in three
 * places that did not agree — so a state the editor accepted could fail to
 * load back, and a text the editor counted could cover the slide it sat on.
 *
 * 1. THE MEMORY-SAFETY BUDGET — what the application can HOLD and still write
 *    back. Serialised size, number of entities, length of the nested
 *    collections. It is a REFUSAL: a command whose projected state breaks it
 *    never becomes an event, so the ceiling is met at the moment of the edit
 *    and never discovered at the next reload. The strict parse (services/
 *    parse/), the command gate (commands/contract.ts) and the published schema
 *    (samples/portfolio.schema.json) all state THIS budget and no other.
 *
 *    IMPORTABLE IS NOT SAVABLE, AND THE TWO ARE NAMED APART. The file ceiling
 *    ({@link MAX_CHARS}, ~10 M characters) says what the FORMAT accepts; the
 *    browser's storage takes about half of that, measured
 *    ({@link MAX_STORED_CHARS}). One figure for both promised what it could
 *    not keep — a portfolio could honour the format and never fit in the
 *    storage, and only the quota's refusal ever said so. The file ceiling now
 *    governs what comes IN (parse, schema, command gate) and the storage
 *    ceiling governs what goes to DISK (services/persistence.ts), which is the
 *    one place the difference can be stated rather than discovered.
 *
 * 2. THE VISUAL-CAPACITY BUDGET — what FITS in the frames the deck draws. It
 *    is not a refusal and must not become one: a pasted paragraph that no
 *    longer fits a box is still the user's text, and losing it would be the
 *    worse failure. It is SAID — the editor counts against it and marks the
 *    field over budget — and the slides CLAMP, so an over-long value is
 *    truncated in its own frame instead of running over its neighbours.
 *
 * The two are deliberately far apart in magnitude: the first is measured in
 * megabytes and thousands of entities, the second in dozens of characters.
 * Confusing them is what produced both of the original faults.
 *
 * PURE module: model + nothing. No clock, no mutation.
 */
import type { Portfolio } from './portfolio'

/* ------------------------- 1. memory safety ------------------------------ */

/**
 * Indentation of the serialised portfolio — the form the document TRAVELS in
 * (`serializePortfolio`, services/portfolio-json.ts) and therefore the form
 * the budget is measured on. It is the LARGER of the two shapes the same
 * document takes (the stored envelope writes it compact), so measuring it
 * bounds both.
 */
export const SERIALIZED_INDENT = 2

/**
 * Ceiling of a serialised portfolio, in characters: ~10 MB. Orders of
 * magnitude above any real portfolio (the samples weigh ~50 kB, an inline logo
 * caps at `LOGO_MAX_CHARS`), and low enough that a mispasted archive never
 * reaches `JSON.parse` — the length check costs nothing and runs FIRST.
 *
 * THIS IS THE FILE CEILING — what the FORMAT accepts, which the strict parse,
 * the command gate and the published schema all state. It is NOT what the
 * browser will keep: see {@link MAX_STORED_CHARS}.
 */
export const MAX_CHARS = 10_000_000

/**
 * Ceiling of the stored ENVELOPE, in characters: ~4 M. A different question
 * from {@link MAX_CHARS}, and the reason the two are now named apart —
 * IMPORTABLE and SAVABLE are not the same size.
 *
 * WHERE THE FIGURE COMES FROM — measured on the browser, not chosen. Chromium
 * takes a 5 200 000-character value under this origin and refuses 5 300 000:
 * the quota is one `localStorage` budget shared by every key, counted in
 * UTF-16 units, and it is the WHOLE store that it bounds, not one value. So
 * the ceiling here is set a clear margin under the measured refusal — room for
 * the preference key, the reader's colour scheme, and whatever a future key
 * adds — rather than at the last size that happened to fit.
 *
 * WHAT IT CHANGES, SAID PLAINLY. A document between this ceiling and
 * {@link MAX_CHARS} is a legal portfolio: it imports, it edits, it exports, it
 * prints. What it does not do is fit in this browser, and {@link MAX_CHARS}
 * alone promised that it would — a portfolio could honour the format and never
 * be savable, and found out only when the quota threw. It is now refused HERE,
 * deterministically, and the save strip says the storage refused with the one
 * offer that still keeps the work: download a copy.
 */
export const MAX_STORED_CHARS = 4_000_000

/**
 * Ceiling on the DECLARED SIZE of an imported file, in bytes — the gate that
 * runs before a single byte is read.
 *
 * It is exact rather than prudent, and the arithmetic is the whole point:
 * {@link MAX_CHARS} counts UTF-16 code units, and no code unit costs more than
 * three bytes in UTF-8 (the three-byte range is the widest; a surrogate pair
 * is two units for four bytes, which is two bytes per unit). A file declaring
 * more than three bytes per allowed unit therefore CANNOT be a text this
 * format accepts, whatever it contains — so refusing it unread refuses nothing
 * legal, and the reader never allocates the several hundred megabytes a
 * `file.text()` on a mispasted archive used to cost.
 */
export const MAX_IMPORT_BYTES = MAX_CHARS * 3

/**
 * Ceiling on the NUMBER of entities a portfolio may carry — projects,
 * categories and free slides together. The byte cap above does not bound this:
 * measured on the built application, 10 MB of JSON holds ~9 800 realistic
 * projects (and ~56 000 minimal ones), and every one of them derives a slide.
 *
 * Where the figure comes from — measured, not chosen. On the built app, with
 * the portfolio restored from storage, the Projects screen renders in 0.4 s at
 * 500 projects, 1.0 s at 1 000, 1.9 s at 2 000 and 9.9 s at 5 000, where a
 * click also takes 0.7 s and the heap reaches 352 MB for 109 000 DOM nodes.
 * 2 000 is the last size that still answers: twice the comfortable one, a
 * hundred times any real portfolio (the samples carry 20), and — the other
 * reason — it stays well under what `localStorage` will actually accept, since
 * a 9 MB document is REFUSED by the browser quota and could never be saved.
 */
export const MAX_ENTITIES = 2_000

/**
 * Ceiling on ONE nested collection — a project's decisions, its milestones,
 * each of its three narrative lists, a free slide's blocks, and the lines of
 * one block. Same figure as {@link MAX_ENTITIES}, and the same reason: a
 * nested row is a rendered row exactly like an entity's, so no single
 * aggregate may carry more of them than the whole document may carry entities.
 * Without it a single project can hold a million rows — under the entity count,
 * over the byte cap, and discovered only at the next reload.
 */
export const MAX_ROWS = 2_000

/** Entities offered by a would-be portfolio, counted on the three arrays
 * WITHOUT reading their elements — the walk is the very cost being refused. */
export const offeredEntities = (raw: Record<string, unknown>): number =>
  ['projects', 'categories', 'freeSlides'].reduce(
    (sum, key) => sum + (Array.isArray(raw[key]) ? (raw[key] as unknown[]).length : 0),
    0,
  )

/** Entities a built portfolio carries. */
export const entityCount = (p: Portfolio): number =>
  p.projects.length + p.categories.length + p.freeSlides.length

/** Length of the document as it travels — see {@link SERIALIZED_INDENT}. */
export const serializedLength = (p: Portfolio): number =>
  JSON.stringify(p, null, SERIALIZED_INDENT).length

/** Every nested collection of one portfolio, as lengths. */
const nestedLengths = (p: Portfolio): readonly number[] => [
  ...p.projects.flatMap((x) => [
    x.done.length,
    x.ongoing.length,
    x.next.length,
    x.decisions.length,
    x.milestones.length,
  ]),
  ...p.freeSlides.flatMap((s) => [s.blocks.length, ...s.blocks.map((b) => b.length)]),
]

/**
 * `true` when the whole projected state stays inside the memory budget — the
 * three ceilings together, cheapest first: three array lengths, then the
 * nested ones, then the serialisation (the only costly check, and the one no
 * cheaper test can stand in for).
 *
 * This is what a creation, a merge or a replacement is measured against, on
 * the state it WOULD produce and not on its payload: a payload that fits says
 * nothing about the document it joins.
 */
export const withinMemoryBudget = (p: Portfolio): boolean =>
  entityCount(p) <= MAX_ENTITIES &&
  nestedLengths(p).every((n) => n <= MAX_ROWS) &&
  serializedLength(p) <= MAX_CHARS

/* ------------------------ 2. visual capacity ----------------------------- */

/**
 * One framed text of the deck — and the list is exactly the set of texts a
 * frame was MEASURED to bound. The names are the BUDGET's, not the model's: a
 * project's `lead` and its `sponsor` share a frame and therefore a figure, and
 * the review title is one budget whichever of the two cover compositions draws
 * it.
 *
 * Fields absent from this list carry NO capacity budget, and that is a
 * measurement, not an oversight: the goal paragraph, the scope, the budget
 * line, the risks, the subtitle, the free-slide title and lines, and the
 * identity lines took 480 characters — the top of the ladder — in all three
 * slide styles without any page losing its content. A counter against a figure
 * nobody measured is what this module exists to remove.
 */
export type CapacityField =
  | 'reviewTitle'
  | 'categoryName'
  | 'projectName'
  | 'projectPerson'
  | 'narrativeLine'
  | 'decisionQuestion'
  | 'decisionDecider'
  | 'milestoneLabel'

/**
 * What each frame holds, in characters — MEASURED on the printed deck (the
 * tightest of the three transpositions: 1122 x 793 at the print type scale),
 * by growing one field at a time over the sample set until some page's content
 * left its own frame, and keeping the last length that still fitted in ALL
 * THREE slide styles. The binding style is named for each.
 *
 * These are the figures the editor counts against. They are NOT a file-format
 * rule and no command refuses them: a longer value is stored and rendered,
 * clipped by its own frame, and said out loud in the form — see the module
 * header.
 */
export const TEXT_CAPACITY: Readonly<Record<CapacityField, number>> = {
  /** Cover headline. 60 in `institutional` and `modern`, where 72 already
   * reaches the indicator row (the fault F-05 reported at 240: `flat` holds
   * 180, the other two do not). */
  reviewTitle: 60,
  /** The sheet rail carries it vertically: 40 in `modern`, 48 in
   * `institutional`, 110 in `flat`. Had no budget at all before. */
  categoryName: 40,
  /** Sheet headline and recap row: 60 in all three, 72 overflows the head. */
  projectName: 60,
  /** Lead and sponsor share the head's meta line: 240 in `flat`, beyond the
   * ladder in the other two. The forms counted 40. */
  projectPerson: 240,
  /** One bullet of the three narrative lists: 110 in `flat`, 240 elsewhere.
   * The forms counted LINES and never characters. */
  narrativeLine: 110,
  /** The decisions table row: 110 in `institutional` and `modern`, 140 in
   * `flat`. The forms counted 160 — over the real frame in two styles. */
  decisionQuestion: 110,
  /** Same row, the decider column: 40 in all three. */
  decisionDecider: 40,
  /** The timeline label: 40 in all three, 48 overflows the sheet. */
  milestoneLabel: 40,
}

/** `true` when the text is beyond what its frame holds — what the editor says
 * out loud, and never what a command refuses. */
export const overCapacity = (field: CapacityField, text: string | undefined): boolean =>
  text !== undefined && text.length > TEXT_CAPACITY[field]
