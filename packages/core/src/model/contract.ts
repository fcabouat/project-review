/**
 * THE MEMORY MIRROR OF THE FILE CONTRACT — what a value must BE at runtime for
 * the file format to be able to read it back. The strict parse
 * (services/parse/) states the same rules on bytes coming IN; these predicates
 * state them on objects already in memory, whoever built them: a command the
 * editor emits (commands/contract.ts), an event replayed out of the browser's
 * storage (services/stored-events.ts), a portfolio handed over by a host.
 *
 * ONE STATEMENT, THREE CALLERS. Before this module the rules were written
 * where the first caller needed them, and a second caller judging the same
 * object more loosely is exactly how a running portfolio ends up holding a
 * value the next boot cannot re-read. Nothing here is restated anywhere else.
 *
 * PER AGGREGATE, NEVER PER FIELD AT THE CALL SITE. A caller that is about to
 * write one field BUILDS the aggregate it would produce (`withField`, the very
 * function `apply` uses) and judges the whole of it — so adding a field to
 * `Project` is covered the day the parse covers it, with no call site to
 * revisit.
 *
 * WHERE EACH RULE COMES FROM. Enumerations come from the sibling model
 * modules, the refined scalars from `values/` (`isoDate`, `progressOf`,
 * `isFontFamily`, `isFontWeight`, `isWoff2DataUri`, `isLogo`, `isHexColor`,
 * `isRecapRows`) — the very constructors and predicates the parse calls.
 *
 * TYPES ARE NOT THE GUARD. Every argument below is typed, but a hand-written
 * object, a cast at a form's edge or a replayed payload can carry anything:
 * these checks are deliberately RUNTIME ones, on values the compiler already
 * believes.
 *
 * PURE module: model + values only, no clock, no mutation.
 */
import type { Category, Color } from './category'
import { COLORS } from './category'
import type { Anchor, FreeSlide } from './free-slide'
import type { Identity, Portfolio, Review, Settings } from './portfolio'
import type { Decision, Milestone, Project } from './project'
import { HEALTH_LEVELS, PRIORITIES, SHEET_MODES, STAGES } from './project'
import { MAX_ROWS, withinMemoryBudget } from './budget'
import type { CustomPalette, EmbeddedFontFace } from './theme'
import { FONT_FACE_STYLES, LANGUAGES, NAVIGATION_MODES, PALETTES, THEME_STYLES } from './theme'
import { isoDate } from '../values/date'
import { isIdText, isCategoryReference } from '../values/ids'
import {
  FONT_FACE_MAX_CHARS,
  FONT_FACES_TOTAL_MAX_CHARS,
  fontFaceSlot,
  isFontFamily,
  isFontWeight,
  isWoff2DataUri,
} from '../values/font'
import { isLogo } from '../values/logo'
import { isHexColor } from '../values/palette'
import { progressOf } from '../values/progress'
import { isRecapRows } from '../values/recap-rows'

/* ------------------------------- key sets -------------------------------- */

/**
 * THE EXACT KEY SET OF ONE AGGREGATE — required keys, then the ones merely
 * allowed. Stated HERE and read by BOTH sides: the strict parse hands them to
 * `checkKeys` on the way in, {@link ownKeysOnly} applies them to an object
 * already in memory. Before this, only the parse knew them, and a runtime
 * object carrying a key the contract does not own passed every runtime
 * validator, was accepted as a command, was stored — and was refused by the
 * parse at the next boot, on the recovery screen.
 *
 * `_keySetCoverage` below proves the full required/optional partition at
 * compile time, including keys added to the model later. Fields defaulted by
 * the parse are named explicitly: optional in the file, required in memory.
 */
export interface KeySet {
  readonly required: readonly string[]
  readonly optional: readonly string[]
}

/** Every key the aggregate owns — the union the checks below police. */
const owned = (set: KeySet): readonly string[] => [...set.required, ...set.optional]

/**
 * `true` when `x` is a plain object carrying NO key beyond the ones `set`
 * owns. A key whose value is `undefined` is an ABSENT key and passes whatever
 * its name: `JSON.stringify` drops it, so the serialised form the parse would
 * read does not carry it either — the two sides must agree about that too.
 *
 * REQUIRED PRESENCE IS NOT CHECKED HERE, and deliberately: every required key
 * already carries a value rule below (`isText`, `isDate`, `oneOf`, a boolean),
 * and a rule that refuses `undefined` is the same refusal said once instead of
 * twice.
 */
export const ownKeysOnly = (x: unknown, set: KeySet): boolean => {
  if (!isRecord(x)) return false
  const known = owned(set)
  for (const key of Object.keys(x)) {
    if (x[key] !== undefined && !known.includes(key)) return false
  }
  return true
}

export const PORTFOLIO_KEYS = {
  required: ['version', 'review', 'settings', 'categories', 'projects', 'freeSlides'],
  optional: [],
} as const

export const REVIEW_KEYS = {
  required: ['title', 'reviewDate'],
  optional: ['subtitle', 'previousReviewDate'],
} as const

export const SETTINGS_KEYS = {
  required: ['identity', 'show', 'recapRows'],
  optional: ['language', 'theme', 'navigation'],
} as const

export const IDENTITY_KEYS = {
  required: ['org', 'unit'],
  optional: ['orgLong', 'unitLong', 'contact', 'logo'],
} as const

export const THEME_KEYS = {
  required: [],
  optional: ['style', 'palette', 'font', 'fontFaces', 'customPalette'],
} as const

export const SHOW_KEYS = {
  required: ['healthDashboard', 'recap', 'archives', 'decisions'],
  optional: [],
} as const

export const FONT_FACE_KEYS = {
  required: ['family', 'dataUri'],
  optional: ['weight', 'style'],
} as const

export const CUSTOM_PALETTE_KEYS = {
  required: ['colors'],
  optional: ['label'],
} as const

export const CATEGORY_KEYS = {
  required: ['id', 'name', 'color'],
  optional: [],
} as const

export const PROJECT_KEYS = {
  required: [
    'id',
    'name',
    'categoryId',
    'stage',
    'onHold',
    'goal',
    'done',
    'ongoing',
    'next',
    'decisions',
    'milestones',
    'sheet',
  ],
  optional: [
    'priority',
    'health',
    'progress',
    'lead',
    'sponsor',
    'scope',
    'budget',
    'start',
    'targetEnd',
    'actualEnd',
    'risks',
    'updatedOn',
    'author',
  ],
} as const

export const DECISION_KEYS = {
  required: ['question'],
  optional: ['decider', 'taken'],
} as const

/** The settled outcome — both halves or neither (see {@link validDecision}). */
export const OUTCOME_KEYS = {
  required: ['text', 'when'],
  optional: [],
} as const

export const MILESTONE_KEYS = {
  required: ['label', 'date', 'done'],
  optional: ['display'],
} as const

export const FREE_SLIDE_KEYS = {
  required: ['id', 'anchor', 'title', 'blocks'],
  optional: [],
} as const

/** An anchor carries its `categoryId` only where it means something. */
export const ANCHOR_KEYS = { required: ['type'], optional: [] } as const
export const ANCHOR_CATEGORY_KEYS = { required: ['type', 'categoryId'], optional: [] } as const

type OptionalKeys<T> = {
  [K in keyof T]-?: Pick<T, K> extends Required<Pick<T, K>> ? never : K
}[keyof T]
type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>
type Difference<A, B> = Exclude<A, B> | Exclude<B, A>
type KeyMismatch<T, S extends KeySet, Defaulted extends RequiredKeys<T> = never> =
  | Difference<S['required'][number], Exclude<RequiredKeys<T>, Defaulted>>
  | Difference<S['optional'][number], OptionalKeys<T> | Defaulted>
type NoMismatch<T extends never> = T

/** No emitted code: a missing, extra or misclassified key fails compilation.
 * The three defaulted partitions below are the parse's explicit exceptions. */
type _keySetCoverage = NoMismatch<
  | KeyMismatch<Portfolio, typeof PORTFOLIO_KEYS>
  | KeyMismatch<Review, typeof REVIEW_KEYS>
  | KeyMismatch<Settings, typeof SETTINGS_KEYS, 'language' | 'theme'>
  | KeyMismatch<Identity, typeof IDENTITY_KEYS>
  | KeyMismatch<Settings['theme'], typeof THEME_KEYS, 'style' | 'palette' | 'font'>
  | KeyMismatch<Settings['show'], typeof SHOW_KEYS>
  | KeyMismatch<EmbeddedFontFace, typeof FONT_FACE_KEYS, 'weight' | 'style'>
  | KeyMismatch<CustomPalette, typeof CUSTOM_PALETTE_KEYS>
  | KeyMismatch<Category, typeof CATEGORY_KEYS>
  | KeyMismatch<Project, typeof PROJECT_KEYS>
  | KeyMismatch<Decision, typeof DECISION_KEYS>
  | KeyMismatch<NonNullable<Decision['taken']>, typeof OUTCOME_KEYS>
  | KeyMismatch<Milestone, typeof MILESTONE_KEYS>
  | KeyMismatch<FreeSlide, typeof FREE_SLIDE_KEYS>
  | KeyMismatch<Extract<Anchor, { type: 'opening' }>, typeof ANCHOR_KEYS>
  | KeyMismatch<Extract<Anchor, { type: 'closing' }>, typeof ANCHOR_KEYS>
  | KeyMismatch<Extract<Anchor, { type: 'beforeCategory' }>, typeof ANCHOR_CATEGORY_KEYS>
>

/* --------------------------- shared vocabulary --------------------------- */

export const isText = (x: unknown): x is string => typeof x === 'string'

/** A plain object — the shape a table of colors must have before it is read. */
export const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

/** A non-empty, well-formed Unicode id — the constructors' shared motif. */
export const isId = (x: unknown): boolean => isText(x) && isIdText(x)

/** A calendar-valid YYYY-MM-DD, built through the one constructor. */
export const isDate = (x: unknown): boolean => isText(x) && isoDate(x) !== undefined

/** An absent value passes; a present one must satisfy the rule. */
export const absentOr = (x: unknown, rule: (v: unknown) => boolean): boolean =>
  x === undefined || rule(x)

/** A member of a closed enumeration — the `enumVal` of the parse. */
export const oneOf = (x: unknown, values: readonly string[]): boolean =>
  isText(x) && values.includes(x)

/**
 * A DENSE array — every index between 0 and `length` carries a value. The
 * element-wise methods (`every`, `map`, `filter`) SKIP holes, so `Array(3)`
 * satisfies any rule it was never shown, while `JSON.stringify` writes `null`
 * in each gap — a value the parse then refuses. An explicit `undefined`
 * element serialises to the same `null` and fails the element rules below,
 * which is why only the holes need saying here.
 * Pinned by the sparse-array case of tests/model/contract-parse.test.ts.
 */
export const isDenseList = (x: unknown): x is readonly unknown[] => {
  if (!Array.isArray(x)) return false
  for (let i = 0; i < x.length; i += 1) if (!(i in x)) return false
  return true
}

/**
 * A COLLECTION POSITION — where a creation inserts, where a move comes from
 * and goes to. A whole number, which is the whole rule: the splice helpers
 * clamp out-of-range indexes, but `NaN`, `±Infinity` and `"3"` walk straight
 * past that clamp, and the first two serialise to `null` — an event the
 * storage takes and the next boot's decoder refuses, so the reorder happens
 * and the log is dropped (tests/model/contract-parse.test.ts).
 */
export const isPosition = (x: unknown): boolean => typeof x === 'number' && Number.isInteger(x)

export const isTextList = (x: unknown): boolean => isDenseList(x) && x.every(isText)

/** A nested collection within the memory-safety budget — dense, and no longer
 * than the ceiling one aggregate may carry (`MAX_ROWS`, model/budget.ts).
 * Written here, in the aggregate rules, so every caller that judges a project
 * or a free slide inherits it: the command gate, the stored-event decoder, a
 * host handing a portfolio over. Without it a single project holds a million
 * rows — under the entity count, over the byte cap, and discovered only at the
 * next reload. */
export const withinRows = (x: unknown): boolean => isDenseList(x) && x.length <= MAX_ROWS

/** No id twice in one collection — the invariant `apply` and `collections.ts`
 * rest on, and the parse's `duplicateId`. */
export const uniqueIds = (items: readonly { readonly id: string }[]): boolean =>
  new Set(items.map((x) => x.id)).size === items.length

/* ---------------------------- the aggregates ----------------------------- */

export const validDecision = (d: Decision): boolean =>
  ownKeysOnly(d, DECISION_KEYS) &&
  isText(d.question) &&
  absentOr(d.decider, isText) &&
  // All or nothing: the parse refuses a half-settled outcome rather than
  // invent one, so an outcome carries BOTH a text and a real date.
  absentOr(
    d.taken,
    (v) =>
      ownKeysOnly(v, OUTCOME_KEYS) &&
      isText((v as Decision['taken'])?.text) &&
      isDate((v as Decision['taken'])?.when),
  )

export const validMilestone = (m: Milestone): boolean =>
  ownKeysOnly(m, MILESTONE_KEYS) &&
  isText(m.label) &&
  isDate(m.date) &&
  absentOr(m.display, isText) &&
  typeof m.done === 'boolean'

/** One project, judged exactly as `parseProjects` judges its serialised twin.
 * `categoryId` may be `''` — the sanctioned unassigned reference. */
export const validProject = (p: Project): boolean =>
  ownKeysOnly(p, PROJECT_KEYS) &&
  isId(p.id) &&
  isText(p.name) &&
  isText(p.categoryId) &&
  isCategoryReference(p.categoryId) &&
  absentOr(p.priority, (v) => oneOf(v, PRIORITIES)) &&
  oneOf(p.stage, STAGES) &&
  typeof p.onHold === 'boolean' &&
  absentOr(p.health, (v) => oneOf(v, HEALTH_LEVELS)) &&
  absentOr(p.progress, (v) => typeof v === 'number' && progressOf(v) !== undefined) &&
  absentOr(p.lead, isText) &&
  absentOr(p.sponsor, isText) &&
  absentOr(p.scope, isText) &&
  isText(p.goal) &&
  absentOr(p.budget, isText) &&
  absentOr(p.start, isDate) &&
  absentOr(p.targetEnd, isDate) &&
  absentOr(p.actualEnd, isDate) &&
  isTextList(p.done) &&
  withinRows(p.done) &&
  isTextList(p.ongoing) &&
  withinRows(p.ongoing) &&
  isTextList(p.next) &&
  withinRows(p.next) &&
  absentOr(p.risks, isText) &&
  withinRows(p.decisions) &&
  p.decisions.every(validDecision) &&
  withinRows(p.milestones) &&
  p.milestones.every(validMilestone) &&
  oneOf(p.sheet, SHEET_MODES) &&
  absentOr(p.updatedOn, isDate) &&
  absentOr(p.author, isText)

/** One category — id non-empty, name a string, color one of the twelve. */
export const validCategory = (c: Category): boolean =>
  ownKeysOnly(c, CATEGORY_KEYS) && isId(c.id) && isText(c.name) && oneOf(c.color, COLORS)

/** An anchor a deck can place: a `beforeCategory` pointing at a category that
 * no longer exists is fine (the deck degrades it), an EMPTY reference is not. */
export const validAnchor = (a: Anchor): boolean =>
  a?.type === 'beforeCategory'
    ? ownKeysOnly(a, ANCHOR_CATEGORY_KEYS) && isId(a.categoryId)
    : ownKeysOnly(a, ANCHOR_KEYS) && (a?.type === 'opening' || a?.type === 'closing')

/** One free slide — id non-empty, structural anchor, and at least one block. */
export const validFreeSlide = (s: FreeSlide): boolean =>
  ownKeysOnly(s, FREE_SLIDE_KEYS) &&
  isId(s.id) &&
  validAnchor(s.anchor) &&
  isText(s.title) &&
  withinRows(s.blocks) &&
  s.blocks.length > 0 &&
  s.blocks.every((b) => isTextList(b) && withinRows(b))

/** Embedded faces have unique family/weight/style slots. `undefined` is none;
 * the parser normalizes an empty array to absence before it reaches the model. */
export const validFontFaces = (faces: readonly EmbeddedFontFace[] | undefined): boolean => {
  if (faces === undefined) return true
  if (!isDenseList(faces) || faces.length === 0) return false
  const sound = faces.every(
    (f) =>
      ownKeysOnly(f, FONT_FACE_KEYS) &&
      isText(f.family) &&
      isFontFamily(f.family) &&
      isText(f.weight) &&
      isFontWeight(f.weight) &&
      oneOf(f.style, FONT_FACE_STYLES) &&
      isText(f.dataUri) &&
      isWoff2DataUri(f.dataUri) &&
      f.dataUri.length <= FONT_FACE_MAX_CHARS,
  )
  const total = faces.reduce((sum, f) => sum + (isText(f?.dataUri) ? f.dataUri.length : 0), 0)
  return (
    sound &&
    total <= FONT_FACES_TOTAL_MAX_CHARS &&
    new Set(faces.map(fontFaceSlot)).size === faces.length
  )
}

/** The portfolio's own palette — `undefined` is "it carries none". The table
 * is judged EXHAUSTIVE, exactly as the parse judges it: the twelve names of
 * the domain, no more and no less, each an exact `#rrggbb`. */
export const validCustomPalette = (palette: CustomPalette | undefined): boolean => {
  if (palette === undefined) return true
  if (!ownKeysOnly(palette, CUSTOM_PALETTE_KEYS)) return false
  if (!absentOr(palette.label, isText)) return false
  const colors: unknown = palette.colors
  if (!isRecord(colors)) return false
  return (
    Object.keys(colors).length === COLORS.length &&
    COLORS.every((name: Color) => isText(colors[name]) && isHexColor(colors[name] as string))
  )
}

export const validIdentity = (i: Identity): boolean =>
  ownKeysOnly(i, IDENTITY_KEYS) &&
  isText(i.org) &&
  isText(i.unit) &&
  absentOr(i.orgLong, isText) &&
  absentOr(i.unitLong, isText) &&
  absentOr(i.contact, isText) &&
  absentOr(i.logo, (v) => isText(v) && isLogo(v))

export const validReview = (r: Review): boolean =>
  ownKeysOnly(r, REVIEW_KEYS) &&
  isText(r.title) &&
  absentOr(r.subtitle, isText) &&
  isDate(r.reviewDate) &&
  absentOr(r.previousReviewDate, isDate)

export const validSettings = (s: Settings): boolean =>
  ownKeysOnly(s, SETTINGS_KEYS) &&
  oneOf(s.language, LANGUAGES) &&
  absentOr(s.navigation, (value) => oneOf(value, NAVIGATION_MODES)) &&
  validIdentity(s.identity) &&
  ownKeysOnly(s.theme, THEME_KEYS) &&
  oneOf(s.theme.style, THEME_STYLES) &&
  oneOf(s.theme.palette, PALETTES) &&
  isText(s.theme.font) &&
  isFontFamily(s.theme.font) &&
  validFontFaces(s.theme.fontFaces) &&
  validCustomPalette(s.theme.customPalette) &&
  ownKeysOnly(s.show, SHOW_KEYS) &&
  typeof s.show.healthDashboard === 'boolean' &&
  typeof s.show.recap === 'boolean' &&
  typeof s.show.archives === 'boolean' &&
  typeof s.show.decisions === 'boolean' &&
  typeof s.recapRows === 'number' &&
  isRecapRows(s.recapRows)

/**
 * A WHOLE portfolio's SHAPE — every aggregate judged by the rules of the file
 * format, ids unique per collection, no key the contract does not own. What it
 * deliberately leaves out is the SIZE: that question is about the document, it
 * is answered once by {@link withinMemoryBudget}, and the two are kept apart so
 * that the command gate can ask the shape question alone and let `decide`
 * weigh the state its event would produce — like every other command.
 */
export const validPortfolioShape = (p: Portfolio): boolean =>
  ownKeysOnly(p, PORTFOLIO_KEYS) &&
  p.version === 3 &&
  validReview(p.review) &&
  validSettings(p.settings) &&
  isDenseList(p.categories) &&
  p.categories.every(validCategory) &&
  uniqueIds(p.categories) &&
  isDenseList(p.projects) &&
  p.projects.every(validProject) &&
  uniqueIds(p.projects) &&
  isDenseList(p.freeSlides) &&
  p.freeSlides.every(validFreeSlide) &&
  uniqueIds(p.freeSlides)

/**
 * A WHOLE portfolio, judged by the rules of the file format — the same verdict
 * `parsePortfolio` would return on its serialised form, reached without
 * re-reading JSON. This is what a portfolio handed over in memory is measured
 * against, whoever built it: the stored-event decoder replaying a
 * `PortfolioReplaced`, a host, the property test of the contract's three
 * voices.
 *
 * THE SIZE AND THE COUNT, WHICH NO PER-AGGREGATE RULE CAN SEE. The parse
 * refuses a file past the entity ceiling before it walks one element, and past
 * the character ceiling before it parses one byte; a document that misses
 * either is one the very next read of the file it becomes would refuse.
 * Cheapest first, the serialisation last — the order `withinMemoryBudget`
 * already states.
 */
export const validPortfolio = (p: Portfolio): boolean =>
  validPortfolioShape(p) && withinMemoryBudget(p)
