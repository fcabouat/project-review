/**
 * THE MEMORY/FILE CONTRACT — the rule that a running portfolio may never hold
 * a value its own file format would refuse to read back. The strict parse
 * (services/parse/) is the door every byte comes through; this module is the
 * SAME contract on the way out, applied to the intents the editor emits, so
 * `decide` refuses exactly what `parsePortfolio` would refuse.
 *
 * Without it the in-memory model is more permissive than the serialised one: a
 * value the editor accepts, the next boot cannot re-read — and a snapshot that
 * cannot be re-read is data the application no longer owns.
 *
 * HOW IT STAYS EXHAUSTIVE. Nothing here re-lists fields one by one: a command
 * is validated by BUILDING the aggregate it would produce — through `apply`'s
 * own `withField`, so the judged value is the value that would be stored — and
 * judging that whole aggregate ({@link honorsContract}). Add a field to
 * `Project` and the per-aggregate check covers it the day the parse does; the
 * only per-key switch left is `ChangeSetting`, whose flattened path has no
 * aggregate of its own, and its `never` sentinel fails the build if a setting
 * is added without a rule.
 *
 * TOTAL, like every domain function: a command whose payload is missing or of
 * the wrong shape is REFUSED, never thrown on.
 *
 * WHERE EACH RULE COMES FROM. Enumerations come from `model/`, the refined
 * scalars from `values/` (`isoDate`, `progressOf`, `isFontFamily`,
 * `isFontWeight`, `isWoff2DataUri`, `isLogo`, `isRecapRows`) — the very
 * constructors and predicates the parse calls. No rule is restated here.
 *
 * TYPES ARE NOT THE GUARD. Every command is typed, but a hand-written command,
 * a cast at a form's edge or a replayed payload can carry anything: these
 * checks are deliberately RUNTIME ones, on values the compiler already
 * believes.
 *
 * PURE module: no Svelte/DOM import, no clock, no mutation.
 */
import type { Category } from '../model/category'
import { COLORS } from '../model/category'
import type { Anchor, FreeSlide } from '../model/free-slide'
import type { Identity, Portfolio, Review, Settings } from '../model/portfolio'
import type { Decision, Milestone, Project } from '../model/project'
import { HEALTH_LEVELS, PRIORITIES, SHEET_MODES, STAGES } from '../model/project'
import type { EmbeddedFontFace } from '../model/theme'
import { FONT_FACE_STYLES, LANGUAGES, PALETTES, THEME_STYLES } from '../model/theme'
import { isoDate } from '../values/date'
import {
  FONT_FACE_MAX_CHARS,
  FONT_FACES_TOTAL_MAX_CHARS,
  isFontFamily,
  isFontWeight,
  isWoff2DataUri,
} from '../values/font'
import { isLogo } from '../values/logo'
import { progressOf } from '../values/progress'
import { isRecapRows } from '../values/recap-rows'
import { withField } from '../events/collections'
import type { ChangeSetting } from './settings'
import type { Command } from './index'

/* --------------------------- shared vocabulary --------------------------- */

const isText = (x: unknown): x is string => typeof x === 'string'

/** A non-empty string — the id motif (values/ids.ts) and the parse's `emptyId`. */
const isId = (x: unknown): boolean => isText(x) && x !== ''

/** A calendar-valid YYYY-MM-DD, built through the one constructor. */
const isDate = (x: unknown): boolean => isText(x) && isoDate(x) !== undefined

/** An absent value passes; a present one must satisfy the rule. */
const absentOr = (x: unknown, rule: (v: unknown) => boolean): boolean => x === undefined || rule(x)

/** A member of a closed enumeration — the `enumVal` of the parse. */
const oneOf = (x: unknown, values: readonly string[]): boolean => isText(x) && values.includes(x)

const isTextList = (x: unknown): boolean => Array.isArray(x) && x.every(isText)

/* ---------------------------- the aggregates ----------------------------- */

const validDecision = (d: Decision): boolean =>
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

const validMilestone = (m: Milestone): boolean =>
  isText(m?.label) && isDate(m.date) && absentOr(m.display, isText) && typeof m.done === 'boolean'

/** One project, judged exactly as `parseProjects` judges its serialised twin.
 * `categoryId` may be `''` — the sanctioned unassigned reference. */
const validProject = (p: Project): boolean =>
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
  isTextList(p.ongoing) &&
  isTextList(p.next) &&
  absentOr(p.risks, isText) &&
  Array.isArray(p.decisions) &&
  p.decisions.every(validDecision) &&
  Array.isArray(p.milestones) &&
  p.milestones.every(validMilestone) &&
  oneOf(p.sheet, SHEET_MODES) &&
  absentOr(p.updatedOn, isDate) &&
  absentOr(p.author, isText)

/** One category — id non-empty, name a string, color one of the twelve. */
const validCategory = (c: Category): boolean =>
  isId(c?.id) && isText(c.name) && oneOf(c.color, COLORS)

/** An anchor a deck can place: a `beforeCategory` pointing at a category that
 * no longer exists is fine (the deck degrades it), an EMPTY reference is not. */
const validAnchor = (a: Anchor): boolean =>
  a?.type === 'opening' ||
  a?.type === 'closing' ||
  (a?.type === 'beforeCategory' && isId(a.categoryId))

/** One free slide — id non-empty, structural anchor, and at least one block. */
const validFreeSlide = (s: FreeSlide): boolean =>
  isId(s?.id) &&
  validAnchor(s.anchor) &&
  isText(s.title) &&
  Array.isArray(s.blocks) &&
  s.blocks.length > 0 &&
  s.blocks.every(isTextList)

/** The embedded faces — `undefined` is "none embedded"; `[]` says the same
 * thing and the parse normalises it away, so it never becomes a stored key. */
const validFontFaces = (faces: readonly EmbeddedFontFace[] | undefined): boolean => {
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

const validIdentity = (i: Identity): boolean =>
  isText(i?.org) &&
  isText(i.unit) &&
  absentOr(i.orgLong, isText) &&
  absentOr(i.unitLong, isText) &&
  absentOr(i.contact, isText) &&
  absentOr(i.logo, (v) => isText(v) && isLogo(v))

const validReview = (r: Review): boolean =>
  isText(r?.title) &&
  absentOr(r.subtitle, isText) &&
  isDate(r.reviewDate) &&
  absentOr(r.previousReviewDate, isDate)

const validSettings = (s: Settings): boolean =>
  oneOf(s?.language, LANGUAGES) &&
  validIdentity(s.identity) &&
  oneOf(s.theme?.style, THEME_STYLES) &&
  oneOf(s.theme.palette, PALETTES) &&
  isText(s.theme.font) &&
  isFontFamily(s.theme.font) &&
  validFontFaces(s.theme.fontFaces) &&
  typeof s.show?.healthDashboard === 'boolean' &&
  typeof s.show.recap === 'boolean' &&
  typeof s.show.archives === 'boolean' &&
  typeof s.show.decisions === 'boolean' &&
  typeof s.recapRows === 'number' &&
  isRecapRows(s.recapRows)

/** No id twice in one collection — the invariant `apply` and `collections.ts`
 * rest on, and the parse's `duplicateId`. */
const uniqueIds = (items: readonly { readonly id: string }[]): boolean =>
  new Set(items.map((x) => x.id)).size === items.length

/**
 * A WHOLE portfolio, judged by the rules of the file format — the same verdict
 * `parsePortfolio` would return on its serialised form, reached without
 * re-reading JSON. This is what an import (`ReplacePortfolio`) is measured
 * against, whoever built it.
 */
const validPortfolio = (p: Portfolio): boolean =>
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

/* ------------------------------ the settings ----------------------------- */

/** The one per-key rule set: the flattened settings path has no aggregate of
 * its own. The `never` sentinel fails the build if a setting joins without a rule. */
const validSetting = (c: ChangeSetting): boolean => {
  switch (c.setting) {
    case 'language':
      return oneOf(c.after, LANGUAGES)
    case 'style':
      return oneOf(c.after, THEME_STYLES)
    case 'palette':
      return oneOf(c.after, PALETTES)
    case 'font':
      return isText(c.after) && isFontFamily(c.after)
    case 'fontFaces':
      return validFontFaces(c.after)
    case 'recapRows':
      return typeof c.after === 'number' && isRecapRows(c.after)
    case 'healthDashboard':
    case 'recap':
    case 'archives':
    case 'decisions':
      return typeof c.after === 'boolean'
  }
  // Exhaustiveness sentinel — unreachable while the union is covered.
  /* v8 ignore start */
  const _unreachable: never = c
  return false
  /* v8 ignore stop */
}

/* ------------------------------- the gate -------------------------------- */

/** The element of `list` bearing this id, or `undefined`. */
const byId = <T extends { readonly id: string }>(list: readonly T[], id: string): T | undefined =>
  list.find((x) => x.id === id)

/**
 * `true` when the command may become an event: the portfolio it would produce
 * still honors the file format's contract. `decide` calls this FIRST and
 * refuses (`undefined`, its ordinary refusal) otherwise — a refused command
 * changes nothing and records nothing, exactly like an inapplicable one.
 *
 * Commands carrying no new value (deletions, moves) have nothing to judge:
 * they pass, and `decide`'s own applicability rules take over.
 */
export const honorsContract = (p: Portfolio, c: Command): boolean => {
  switch (c.type) {
    case 'ChangeReviewField':
      return validReview(withField(p.review, c.field, c.after))

    case 'ChangeIdentityField':
      return validIdentity(withField(p.settings.identity, c.field, c.after))

    case 'ChangeSetting':
      return validSetting(c)

    case 'CreateCategory':
      return validCategory(c.category) && byId(p.categories, c.category.id) === undefined

    case 'RenameCategory':
      return isText(c.after)

    case 'RecolorCategory':
      return oneOf(c.after, COLORS)

    case 'CreateProject':
      return validProject(c.project) && byId(p.projects, c.project.id) === undefined

    case 'RenumberProject':
      // Uniqueness and triviality stay with `decide`; the id MOTIF is here.
      return isId(c.newId)

    case 'ChangeProjectField': {
      const project = byId(p.projects, c.id)
      return project === undefined || validProject(withField(project, c.field, c.after))
    }

    case 'ChangeProjectList': {
      const project = byId(p.projects, c.id)
      return project === undefined || validProject(withField(project, c.list, c.after))
    }

    case 'ChangeProjectMilestones':
      return Array.isArray(c.after) && c.after.every(validMilestone)

    case 'ChangeProjectDecisions':
      return Array.isArray(c.after) && c.after.every(validDecision)

    case 'CreateFreeSlide':
      return validFreeSlide(c.slide) && byId(p.freeSlides, c.slide.id) === undefined

    case 'ChangeFreeSlide': {
      // The replacement may carry a NEW id — free as long as no other slide
      // already holds it (the uniqueness invariant, kept by construction).
      const clash = byId(p.freeSlides, c.after?.id)
      return validFreeSlide(c.after) && (clash === undefined || clash.id === c.id)
    }

    case 'ReplacePortfolio':
      return validPortfolio(c.portfolio)

    case 'MergeProjects':
      return (
        Array.isArray(c.projects) &&
        c.projects.every(validProject) &&
        uniqueIds(c.projects) &&
        Array.isArray(c.categories) &&
        c.categories.every(validCategory) &&
        uniqueIds(c.categories)
      )

    case 'DeleteCategory':
    case 'MoveCategory':
    case 'DeleteProject':
    case 'MoveProject':
    case 'DeleteFreeSlide':
    case 'MoveFreeSlide':
      return true
  }
  // Exhaustiveness sentinel — unreachable while the union is covered.
  /* v8 ignore start */
  const _unreachable: never = c
  return false
  /* v8 ignore stop */
}
