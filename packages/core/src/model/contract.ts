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
import { MAX_ROWS } from './budget'
import type { CustomPalette, EmbeddedFontFace } from './theme'
import { FONT_FACE_STYLES, LANGUAGES, PALETTES, THEME_STYLES } from './theme'
import { isoDate } from '../values/date'
import {
  FONT_FACE_MAX_CHARS,
  FONT_FACES_TOTAL_MAX_CHARS,
  isFontFamily,
  isFontWeight,
  isWoff2DataUri,
} from '../values/font'
import { isLogo } from '../values/logo'
import { isHexColor } from '../values/palette'
import { progressOf } from '../values/progress'
import { isRecapRows } from '../values/recap-rows'

/* --------------------------- shared vocabulary --------------------------- */

export const isText = (x: unknown): x is string => typeof x === 'string'

/** A plain object — the shape a table of colors must have before it is read. */
export const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

/** A non-empty string — the id motif (values/ids.ts) and the parse's `emptyId`. */
export const isId = (x: unknown): boolean => isText(x) && x !== ''

/** A calendar-valid YYYY-MM-DD, built through the one constructor. */
export const isDate = (x: unknown): boolean => isText(x) && isoDate(x) !== undefined

/** An absent value passes; a present one must satisfy the rule. */
export const absentOr = (x: unknown, rule: (v: unknown) => boolean): boolean =>
  x === undefined || rule(x)

/** A member of a closed enumeration — the `enumVal` of the parse. */
export const oneOf = (x: unknown, values: readonly string[]): boolean =>
  isText(x) && values.includes(x)

export const isTextList = (x: unknown): boolean => Array.isArray(x) && x.every(isText)

/** A nested collection within the memory-safety budget — the ceiling one
 * aggregate may carry (`MAX_ROWS`, model/budget.ts). Written here, in the
 * aggregate rules, so every caller that judges a project or a free slide
 * inherits it: the command gate, the stored-event decoder, a host handing a
 * portfolio over. Without it a single project holds a million rows — under the
 * entity count, over the byte cap, and discovered only at the next reload. */
export const withinRows = (x: unknown): boolean => Array.isArray(x) && x.length <= MAX_ROWS

/** No id twice in one collection — the invariant `apply` and `collections.ts`
 * rest on, and the parse's `duplicateId`. */
export const uniqueIds = (items: readonly { readonly id: string }[]): boolean =>
  new Set(items.map((x) => x.id)).size === items.length

/* ---------------------------- the aggregates ----------------------------- */

export const validDecision = (d: Decision): boolean =>
  isText(d?.question) &&
  absentOr(d.decider, isText) &&
  // All or nothing: the parse refuses a half-settled outcome rather than
  // invent one, so an outcome carries BOTH a text and a real date.
  absentOr(
    d.taken,
    (v) =>
      typeof v === 'object' &&
      v !== null &&
      isText((v as Decision['taken'])?.text) &&
      isDate((v as Decision['taken'])?.when),
  )

export const validMilestone = (m: Milestone): boolean =>
  isText(m?.label) && isDate(m.date) && absentOr(m.display, isText) && typeof m.done === 'boolean'

/** One project, judged exactly as `parseProjects` judges its serialised twin.
 * `categoryId` may be `''` — the sanctioned unassigned reference. */
export const validProject = (p: Project): boolean =>
  isId(p?.id) &&
  isText(p.name) &&
  isText(p.categoryId) &&
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
  isId(c?.id) && isText(c.name) && oneOf(c.color, COLORS)

/** An anchor a deck can place: a `beforeCategory` pointing at a category that
 * no longer exists is fine (the deck degrades it), an EMPTY reference is not. */
export const validAnchor = (a: Anchor): boolean =>
  a?.type === 'opening' ||
  a?.type === 'closing' ||
  (a?.type === 'beforeCategory' && isId(a.categoryId))

/** One free slide — id non-empty, structural anchor, and at least one block. */
export const validFreeSlide = (s: FreeSlide): boolean =>
  isId(s?.id) &&
  validAnchor(s.anchor) &&
  isText(s.title) &&
  withinRows(s.blocks) &&
  s.blocks.length > 0 &&
  s.blocks.every((b) => isTextList(b) && withinRows(b))

/** The embedded faces — `undefined` is "none embedded"; `[]` says the same
 * thing and the parse normalises it away, so it never becomes a stored key. */
export const validFontFaces = (faces: readonly EmbeddedFontFace[] | undefined): boolean => {
  if (faces === undefined) return true
  if (!Array.isArray(faces) || faces.length === 0) return false
  const sound = faces.every(
    (f) =>
      isText(f?.family) &&
      isFontFamily(f.family) &&
      isText(f.weight) &&
      isFontWeight(f.weight) &&
      oneOf(f.style, FONT_FACE_STYLES) &&
      isText(f.dataUri) &&
      isWoff2DataUri(f.dataUri) &&
      f.dataUri.length <= FONT_FACE_MAX_CHARS,
  )
  const total = faces.reduce((sum, f) => sum + (isText(f?.dataUri) ? f.dataUri.length : 0), 0)
  return sound && total <= FONT_FACES_TOTAL_MAX_CHARS
}

/** The portfolio's own palette — `undefined` is "it carries none". The table
 * is judged EXHAUSTIVE, exactly as the parse judges it: the twelve names of
 * the domain, no more and no less, each an exact `#rrggbb`. */
export const validCustomPalette = (palette: CustomPalette | undefined): boolean => {
  if (palette === undefined) return true
  if (typeof palette !== 'object' || palette === null) return false
  if (!absentOr(palette.label, isText)) return false
  const colors: unknown = palette.colors
  if (!isRecord(colors)) return false
  return (
    Object.keys(colors).length === COLORS.length &&
    COLORS.every((name: Color) => isText(colors[name]) && isHexColor(colors[name] as string))
  )
}

export const validIdentity = (i: Identity): boolean =>
  isText(i?.org) &&
  isText(i.unit) &&
  absentOr(i.orgLong, isText) &&
  absentOr(i.unitLong, isText) &&
  absentOr(i.contact, isText) &&
  absentOr(i.logo, (v) => isText(v) && isLogo(v))

export const validReview = (r: Review): boolean =>
  isText(r?.title) &&
  absentOr(r.subtitle, isText) &&
  isDate(r.reviewDate) &&
  absentOr(r.previousReviewDate, isDate)

export const validSettings = (s: Settings): boolean =>
  oneOf(s?.language, LANGUAGES) &&
  validIdentity(s.identity) &&
  oneOf(s.theme?.style, THEME_STYLES) &&
  oneOf(s.theme.palette, PALETTES) &&
  isText(s.theme.font) &&
  isFontFamily(s.theme.font) &&
  validFontFaces(s.theme.fontFaces) &&
  validCustomPalette(s.theme.customPalette) &&
  typeof s.show?.healthDashboard === 'boolean' &&
  typeof s.show.recap === 'boolean' &&
  typeof s.show.archives === 'boolean' &&
  typeof s.show.decisions === 'boolean' &&
  typeof s.recapRows === 'number' &&
  isRecapRows(s.recapRows)

/**
 * A WHOLE portfolio, judged by the rules of the file format — the same verdict
 * `parsePortfolio` would return on its serialised form, reached without
 * re-reading JSON. This is what an import (`ReplacePortfolio`) is measured
 * against, whoever built it.
 */
export const validPortfolio = (p: Portfolio): boolean =>
  p?.version === 3 &&
  validReview(p.review) &&
  validSettings(p.settings) &&
  Array.isArray(p.categories) &&
  p.categories.every(validCategory) &&
  uniqueIds(p.categories) &&
  Array.isArray(p.projects) &&
  p.projects.every(validProject) &&
  uniqueIds(p.projects) &&
  Array.isArray(p.freeSlides) &&
  p.freeSlides.every(validFreeSlide) &&
  uniqueIds(p.freeSlides)
