/**
 * THE COMMAND GATE of the memory/file contract — the rule that a running
 * portfolio may never hold a value its own file format would refuse to read
 * back, applied to the intents the editor emits, so `decide` refuses exactly
 * what `parsePortfolio` would refuse.
 *
 * Without it the in-memory model is more permissive than the serialised one: a
 * value the editor accepts, the next boot cannot re-read — and a stored
 * document that cannot be re-read is data the application no longer owns.
 *
 * THE RULES THEMSELVES LIVE IN `model/contract.ts` — one statement, three
 * callers (this gate, the stored-event decoder, and whoever hands a portfolio
 * over). Nothing is restated here; this module only says WHICH aggregate each
 * command would produce.
 *
 * THE SIZE OF THE DOCUMENT IS NOT JUDGED HERE, for any command — including
 * the one whose value IS a whole document. This gate answers one question —
 * would the VALUE the command carries be readable back? — and the memory
 * budget answers another, about the whole document the event would leave
 * behind. That second one is weighed once, after the event is completed, in
 * `decide`: a gate that had to know which commands grow the document was a
 * gate that had to enumerate them, and the enumeration is what let a
 * ten-million-character title through. A replacement is weighed there too, on
 * the state it would install — which is its own payload — so the shape rule
 * here reads `validPortfolioShape` and no serialisation happens twice.
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
 * TYPES ARE NOT THE GUARD. Every command is typed, but a hand-written command,
 * a cast at a form's edge or a replayed payload can carry anything: these
 * checks are deliberately RUNTIME ones, on values the compiler already
 * believes.
 *
 * PURE module: no Svelte/DOM import, no clock, no mutation.
 */
import { COLORS } from '../model/category'
import type { Portfolio } from '../model/portfolio'
import {
  isDenseList,
  isId,
  isPosition,
  withinRows,
  isText,
  oneOf,
  uniqueIds,
  validCategory,
  validCustomPalette,
  validDecision,
  validFontFaces,
  validFreeSlide,
  validIdentity,
  validMilestone,
  validPortfolioShape,
  validProject,
  validReview,
} from '../model/contract'
import { LANGUAGES, PALETTES, THEME_STYLES } from '../model/theme'
import { isFontFamily } from '../values/font'
import { isRecapRows } from '../values/recap-rows'
import { withField } from '../events/collections'
import type { ChangeSetting } from './settings'
import type { Command } from './index'

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
    case 'customPalette':
      return validCustomPalette(c.after)
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
 * A deletion carries no new value and has nothing to judge: it passes, and
 * `decide`'s own applicability rules take over.
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
      return (
        validCategory(c.category) &&
        isPosition(c.index) &&
        byId(p.categories, c.category.id) === undefined
      )

    case 'RenameCategory':
      return isText(c.after)

    case 'RecolorCategory':
      return oneOf(c.after, COLORS)

    case 'CreateProject':
      return (
        validProject(c.project) &&
        isPosition(c.index) &&
        byId(p.projects, c.project.id) === undefined
      )

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
      return withinRows(c.after) && c.after.every(validMilestone)

    case 'ChangeProjectDecisions':
      return withinRows(c.after) && c.after.every(validDecision)

    case 'CreateFreeSlide':
      return (
        validFreeSlide(c.slide) &&
        isPosition(c.index) &&
        byId(p.freeSlides, c.slide.id) === undefined
      )

    case 'ChangeFreeSlide': {
      // The replacement may carry a NEW id — free as long as no other slide
      // already holds it (the uniqueness invariant, kept by construction).
      const clash = byId(p.freeSlides, c.after?.id)
      return validFreeSlide(c.after) && (clash === undefined || clash.id === c.id)
    }

    case 'ReplacePortfolio':
      return validPortfolioShape(c.portfolio)

    case 'MergeProjects':
      return (
        isDenseList(c.projects) &&
        c.projects.every(validProject) &&
        uniqueIds(c.projects) &&
        isDenseList(c.categories) &&
        c.categories.every(validCategory) &&
        uniqueIds(c.categories)
      )

    // The three moves carry no value but a DESTINATION, and a destination is
    // a value: `insertAt` clamps a number out of range, and clamps nothing at
    // all around `NaN` — which reorders the collection and then serialises to
    // `null`, leaving an event the next boot's decoder throws the log away for.
    case 'MoveCategory':
    case 'MoveProject':
    case 'MoveFreeSlide':
      return isPosition(c.to)

    case 'DeleteCategory':
    case 'DeleteProject':
    case 'DeleteFreeSlide':
      return true
  }
  // Exhaustiveness sentinel — unreachable while the union is covered.
  /* v8 ignore start */
  const _unreachable: never = c
  return false
  /* v8 ignore stop */
}
