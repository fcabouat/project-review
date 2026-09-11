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
 * AND THE BUDGET IS WEIGHED ON THE PROJECTED STATE. A creation, a merge and a
 * replacement are the three commands that GROW the document, and each is
 * judged on the whole portfolio it would produce — not on its payload. That
 * is the difference between refusing the two-thousand-and-first project now
 * and discovering at the next boot that the file no longer loads.
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
import { withinMemoryBudget } from '../model/budget'
import {
  isId,
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
  validPortfolio,
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
 * THE STATE A GROWING COMMAND WOULD PRODUCE — the whole document, not the
 * payload it arrives with. A payload that fits says nothing about the
 * portfolio it joins: a project under every per-aggregate rule is still the
 * two-thousand-and-first, and a merge of perfectly valid contributions is
 * still the one that pushes the file past what can be read back.
 *
 * Only SIZE is judged on this value, and size is order-blind — so the
 * reconstruction below does not have to reproduce the merge's positions, only
 * its content: the same elements, hence the same entity count, the same nested
 * lengths and the same serialised length as the state `apply` will build.
 */
const projectedState = (p: Portfolio, c: Command): Portfolio | undefined => {
  switch (c.type) {
    case 'CreateCategory':
      return { ...p, categories: [...p.categories, c.category] }
    case 'CreateProject':
      return { ...p, projects: [...p.projects, c.project] }
    case 'CreateFreeSlide':
      return { ...p, freeSlides: [...p.freeSlides, c.slide] }
    case 'ReplacePortfolio':
      return c.portfolio
    case 'MergeProjects': {
      // The merge contract (commands/merge.ts): an incoming project REPLACES
      // its homonym, an unknown category is appended, a homonym category keeps
      // the present version. Content-identical to what `apply` will hold.
      const arriving = new Set(c.projects.map((x) => x.id))
      const present = new Set(p.categories.map((x) => x.id))
      return {
        ...p,
        projects: [...p.projects.filter((x) => !arriving.has(x.id)), ...c.projects],
        categories: [...p.categories, ...c.categories.filter((x) => !present.has(x.id))],
      }
    }
    default:
      return undefined
  }
}

/** The memory-safety budget on the projected state — `true` for the commands
 * that cannot grow the document (there is nothing to weigh). */
const affordable = (p: Portfolio, c: Command): boolean => {
  const next = projectedState(p, c)
  return next === undefined || withinMemoryBudget(next)
}

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
      return (
        validCategory(c.category) &&
        byId(p.categories, c.category.id) === undefined &&
        affordable(p, c)
      )

    case 'RenameCategory':
      return isText(c.after)

    case 'RecolorCategory':
      return oneOf(c.after, COLORS)

    case 'CreateProject':
      return (
        validProject(c.project) && byId(p.projects, c.project.id) === undefined && affordable(p, c)
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
        validFreeSlide(c.slide) && byId(p.freeSlides, c.slide.id) === undefined && affordable(p, c)
      )

    case 'ChangeFreeSlide': {
      // The replacement may carry a NEW id — free as long as no other slide
      // already holds it (the uniqueness invariant, kept by construction).
      const clash = byId(p.freeSlides, c.after?.id)
      return validFreeSlide(c.after) && (clash === undefined || clash.id === c.id)
    }

    case 'ReplacePortfolio':
      return validPortfolio(c.portfolio) && affordable(p, c)

    case 'MergeProjects':
      return (
        Array.isArray(c.projects) &&
        c.projects.every(validProject) &&
        uniqueIds(c.projects) &&
        Array.isArray(c.categories) &&
        c.categories.every(validCategory) &&
        uniqueIds(c.categories) &&
        // LAST, and it has to be: the projected state is built from the
        // payload, so the payload must have been judged a shape first — the
        // gate is total over a command carrying anything at all.
        affordable(p, c)
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
