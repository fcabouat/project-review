/**
 * `invert` — the pure inverse of every event, built solely from what the event
 * carries (design rule 1 of the events barrel, index.ts): the portfolio is
 * never consulted.
 */
import type { DomainEvent } from './index'

/**
 * Swaps `before` and `after`. The field ↔ value-type correlation is preserved
 * by construction (the discriminant is left alone) but escapes inference over a
 * correlated union: hence the module's single assertion.
 */
const swap = <E extends { readonly before: unknown; readonly after: unknown }>(e: E): E =>
  ({ ...e, before: e.after, after: e.before }) as E

/**
 * Inverse of an event — pure, without consulting the portfolio.
 * `apply(apply(p, e), invert(e))` is structurally `p` only under the
 * preconditions of the events barrel and `collections.ts`: a truthful `before` on
 * the event and ids unique per collection. Involutive: `invert(invert(e))`
 * rebuilds `e` (structurally — a new object each time).
 *
 * @see apply for what happens when the inverse finds no target.
 */
export const invert = (e: DomainEvent): DomainEvent => {
  switch (e.type) {
    case 'ReviewFieldChanged':
    case 'IdentityFieldChanged':
    case 'SettingChanged':
    case 'CategoryRenamed':
    case 'CategoryRecolored':
    case 'ProjectFieldChanged':
    case 'ProjectListChanged':
    case 'ProjectMilestonesChanged':
    case 'ProjectDecisionsChanged':
    case 'PortfolioReplaced':
    // A merge swaps too: its slices carry position as well as content, and
    // `apply` splices symmetrically (events/portfolio.ts states the shape).
    case 'ProjectsMerged':
      return swap(e)

    case 'CategoryCreated':
      return { type: 'CategoryDeleted', category: e.category, index: e.index }

    case 'CategoryDeleted':
      return { type: 'CategoryCreated', category: e.category, index: e.index }

    case 'CategoryMoved':
    case 'ProjectMoved':
    case 'FreeSlideMoved':
      return { type: e.type, id: e.id, from: e.to, to: e.from }

    case 'ProjectCreated':
      return { type: 'ProjectDeleted', project: e.project, index: e.index }

    case 'ProjectDeleted':
      return { type: 'ProjectCreated', project: e.project, index: e.index }

    case 'ProjectRenumbered':
      return { type: 'ProjectRenumbered', oldId: e.newId, newId: e.oldId }

    case 'FreeSlideCreated':
      return { type: 'FreeSlideDeleted', slide: e.slide, index: e.index }

    case 'FreeSlideDeleted':
      return { type: 'FreeSlideCreated', slide: e.slide, index: e.index }

    // Routing follows the arrival id: a re-identified slide stays invertible.
    case 'FreeSlideChanged':
      return { type: 'FreeSlideChanged', id: e.after.id, before: e.after, after: e.before }
  }
  // Exhaustiveness sentinel — unreachable while the union is covered.
  /* v8 ignore start */
  const _unreachable: never = e
  return e
  /* v8 ignore stop */
}
