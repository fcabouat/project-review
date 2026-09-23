/**
 * `decide` — the HANDLERS of the use-cases: one per-aggregate rule set that
 * completes a {@link Command} into a {@link DomainEvent} by reading the
 * present portfolio (docs/overview.md, the loop). Every `before`, `from` and recovered
 * payload the event carries comes from `p` at decision time, so the event's
 * undo data is true BY CONSTRUCTION — the precondition `apply`/`invert` state
 * and cannot check for themselves.
 *
 * `undefined` means "no event to record", in exactly three situations:
 *  - OFF CONTRACT — the value carried would produce a portfolio the file
 *    format cannot read back: the running model is never allowed to be more
 *    permissive than the serialised one, so what `parsePortfolio` refuses at
 *    the door, `decide` refuses on the way out. Two halves, and they are
 *    weighed at two different moments — the SHAPE of the value before the
 *    event is built (contract.ts, checked first), the SIZE of the document
 *    after it is (see {@link verdict});
 *  - INAPPLICABLE — the target id resolves to nothing;
 *  - TRIVIAL — a scalar intent whose `after` already is the current value
 *    (moves included: same position), so applying it would change nothing and
 *    undoing it would be a lie in the history.
 * Wholesale replacements (lists, milestones, decisions, whole slides, whole
 * portfolios) always produce their event: equality of deep payloads is the
 * emitter's business, not `decide`'s. The ONE exception is the merge
 * (`MergeProjects`): a contribution file is nobody's live edit, so a merge
 * strictly void of effect is refused here — structurally, by contract
 * (merge.ts).
 *
 * PURE module: no Svelte/DOM import, no clock, no mutation.
 */
import type { Portfolio } from '../model/portfolio'
import type { DomainEvent } from '../events/index'
import type { Command } from './index'
import { apply } from '../events/apply'
import { withinMemoryBudget } from '../model/budget'
import { settingValue } from '../events/settings'
import { completeMerge } from './merge'
import { honorsContract } from './contract'

/** Index of the first element with this id, or `undefined` — never `-1`. */
const indexOf = (list: readonly { readonly id: string }[], id: string): number | undefined => {
  const i = list.findIndex((x) => x.id === id)
  return i < 0 ? undefined : i
}

/**
 * Completes one command into the event it would record — the per-aggregate
 * rules and nothing else. `undefined` for an inapplicable or trivial command
 * (module header). The three field-indexed constructions assert their result:
 * the field ↔ value-type correlation is guaranteed by the command's own typing
 * but escapes inference over a correlated union — same documented pattern as
 * `invert`'s `swap`.
 */
const complete = (p: Portfolio, c: Command): DomainEvent | undefined => {
  switch (c.type) {
    case 'ChangeReviewField': {
      const before = p.review[c.field]
      if (before === c.after) return undefined
      return { type: 'ReviewFieldChanged', field: c.field, before, after: c.after } as DomainEvent
    }

    case 'ChangeIdentityField': {
      const before = p.settings.identity[c.field]
      if (before === c.after) return undefined
      return { type: 'IdentityFieldChanged', field: c.field, before, after: c.after } as DomainEvent
    }

    case 'ChangeSetting': {
      const before = settingValue(p.settings, c.setting)
      if (before === c.after) return undefined
      return { type: 'SettingChanged', setting: c.setting, before, after: c.after } as DomainEvent
    }

    case 'CreateCategory':
      return { type: 'CategoryCreated', category: c.category, index: c.index }

    case 'DeleteCategory': {
      const index = indexOf(p.categories, c.id)
      if (index === undefined) return undefined
      return { type: 'CategoryDeleted', category: p.categories[index]!, index }
    }

    case 'RenameCategory': {
      const category = p.categories.find((x) => x.id === c.id)
      if (category === undefined || category.name === c.after) return undefined
      return { type: 'CategoryRenamed', id: c.id, before: category.name, after: c.after }
    }

    case 'RecolorCategory': {
      const category = p.categories.find((x) => x.id === c.id)
      if (category === undefined || category.color === c.after) return undefined
      return { type: 'CategoryRecolored', id: c.id, before: category.color, after: c.after }
    }

    case 'MoveCategory': {
      const from = indexOf(p.categories, c.id)
      if (from === undefined || from === c.to) return undefined
      return { type: 'CategoryMoved', id: c.id, from, to: c.to }
    }

    case 'CreateProject':
      return { type: 'ProjectCreated', project: c.project, index: c.index }

    case 'DeleteProject': {
      const index = indexOf(p.projects, c.id)
      if (index === undefined) return undefined
      return { type: 'ProjectDeleted', project: p.projects[index]!, index }
    }

    case 'MoveProject': {
      const from = indexOf(p.projects, c.id)
      if (from === undefined || from === c.to) return undefined
      return { type: 'ProjectMoved', id: c.id, from, to: c.to }
    }

    case 'ChangeProjectField': {
      const project = p.projects.find((x) => x.id === c.id)
      if (project === undefined) return undefined
      const before = project[c.field]
      if (before === c.after) return undefined
      return {
        type: 'ProjectFieldChanged',
        id: c.id,
        field: c.field,
        before,
        after: c.after,
      } as DomainEvent
    }

    case 'ChangeProjectList': {
      const project = p.projects.find((x) => x.id === c.id)
      if (project === undefined) return undefined
      return {
        type: 'ProjectListChanged',
        id: c.id,
        list: c.list,
        before: project[c.list],
        after: c.after,
      }
    }

    case 'ChangeProjectMilestones': {
      const project = p.projects.find((x) => x.id === c.id)
      if (project === undefined) return undefined
      return {
        type: 'ProjectMilestonesChanged',
        id: c.id,
        before: project.milestones,
        after: c.after,
      }
    }

    case 'ChangeProjectDecisions': {
      const project = p.projects.find((x) => x.id === c.id)
      if (project === undefined) return undefined
      return {
        type: 'ProjectDecisionsChanged',
        id: c.id,
        before: project.decisions,
        after: c.after,
      }
    }

    case 'CreateFreeSlide':
      return { type: 'FreeSlideCreated', slide: c.slide, index: c.index }

    case 'DeleteFreeSlide': {
      const index = indexOf(p.freeSlides, c.id)
      if (index === undefined) return undefined
      return { type: 'FreeSlideDeleted', slide: p.freeSlides[index]!, index }
    }

    case 'ChangeFreeSlide': {
      const slide = p.freeSlides.find((x) => x.id === c.id)
      if (slide === undefined) return undefined
      return { type: 'FreeSlideChanged', id: c.id, before: slide, after: c.after }
    }

    case 'MoveFreeSlide': {
      const from = indexOf(p.freeSlides, c.id)
      if (from === undefined || from === c.to) return undefined
      return { type: 'FreeSlideMoved', id: c.id, from, to: c.to }
    }

    case 'ReplacePortfolio':
      return { type: 'PortfolioReplaced', before: p, after: c.portfolio }

    case 'MergeProjects':
      // The one completion that computes positions, not just a `before`:
      // handed to its own module (merge.ts — the merge contract lives there).
      return completeMerge(p, c)
  }
  // Exhaustiveness sentinel — unreachable while the union is covered.
  /* v8 ignore start */
  const _unreachable: never = c
  return undefined
  /* v8 ignore stop */
}

/**
 * WHY a command records nothing, as a value: the refusals of the module header,
 * with the inapplicable and the trivial under one name — from the outside they
 * are the same answer, nothing to record.
 *
 * `decide` hands back the event alone, which is all the runtime ever needs; a
 * screen that has to TELL the user which refusal it hit asks {@link verdict}
 * instead. The import dialog does, and that is why this exists: a merge that
 * changes nothing and a merge that would not fit were both "no event", and only
 * one of them is something the person can act on.
 */
export type Refusal = 'offContract' | 'noEffect' | 'overBudget'

/** What `decide` concluded — the event to record, or why there is none. Same
 * shape as the parse's own outcome (`ParseResult`), for the same reason: a
 * refusal that carries its reason is a refusal a view can word. */
export type Verdict =
  | { readonly ok: true; readonly event: DomainEvent }
  | { readonly ok: false; readonly refusal: Refusal }

/**
 * Decides one command against the present portfolio, and says WHY when it
 * records nothing. Total, and the one place the three questions are asked:
 * {@link decide} is this function with the reason dropped.
 *
 * THE MEMORY BUDGET IS WEIGHED HERE, ON THE STATE THE EVENT WOULD PRODUCE —
 * once, after the event is completed, and therefore for whatever the union
 * holds today or gains tomorrow. It used to be weighed inside the shape gate,
 * on a projection listing the commands thought to GROW the document; a title
 * is not on such a list and a ten-million-character title was accepted, kept,
 * and refused only when the save came round. There is no list any more: the
 * candidate state is built and measured.
 *
 * WHAT IT COSTS, SAID PLAINLY. `withinMemoryBudget` serialises the candidate,
 * so every accepted command pays one `JSON.stringify` of the document and one
 * extra `apply` (`execute` applies the event again to keep it). On the sample
 * set (~50 kB) that is a fraction of a millisecond per keystroke; at the entity
 * ceiling it is tens of milliseconds, on a document a hundred times larger than
 * any real one. The order inside `withinMemoryBudget` is the mitigation — three
 * array lengths, then the nested ones, then the serialisation — and the trade
 * is deliberate: discovering at the next reload that the file no longer loads
 * costs more than any keystroke.
 */
export const verdict = (p: Portfolio, c: Command): Verdict => {
  // The shape first: a command carrying a value the file format would refuse
  // never becomes an event, whatever else is true of it.
  if (!honorsContract(p, c)) return { ok: false, refusal: 'offContract' }
  const event = complete(p, c)
  if (event === undefined) return { ok: false, refusal: 'noEffect' }
  return withinMemoryBudget(apply(p, event))
    ? { ok: true, event }
    : { ok: false, refusal: 'overBudget' }
}

/**
 * Decides one command against the present portfolio. Total: returns the
 * completed event, or `undefined` when the command is off contract,
 * inapplicable or trivial (module header) — {@link verdict} says which.
 */
export const decide = (p: Portfolio, c: Command): DomainEvent | undefined => {
  const v = verdict(p, c)
  return v.ok ? v.event : undefined
}
