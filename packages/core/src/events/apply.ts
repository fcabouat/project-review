/**
 * `apply` — the one way an event changes a portfolio. Total, immutable and
 * id-routed (design rules of the events barrel, index.ts); untouched sub-trees
 * keep their references (structural copy).
 */
import type { Portfolio, Settings } from '../model/portfolio'
import type { SettingChanged } from './settings'
import type { DomainEvent } from './index'
import { insertAt, moveById, removeById, replaceSlice, updateById, withField } from './collections'

const applySetting = (s: Settings, e: SettingChanged): Settings => {
  switch (e.setting) {
    case 'language':
      return { ...s, language: e.after }
    case 'style':
      return { ...s, theme: { ...s.theme, style: e.after } }
    case 'palette':
      return { ...s, theme: { ...s.theme, palette: e.after } }
    case 'font':
      return { ...s, theme: { ...s.theme, font: e.after } }
    case 'fontFaces':
      // `withField`: an `undefined` after ERASES the key, so undoing the very
      // first embed restores a theme with no `fontFaces` key at all.
      return { ...s, theme: withField(s.theme, 'fontFaces', e.after) }
    case 'recapRows':
      return { ...s, recapRows: e.after }
    case 'healthDashboard':
    case 'recap':
    case 'archives':
    case 'decisions':
      return { ...s, show: withField(s.show, e.setting, e.after) }
  }
  // Exhaustiveness sentinel — unreachable while the union is covered.
  /* v8 ignore start */
  const _unreachable: never = e
  return s
  /* v8 ignore stop */
}

/**
 * Applies an event. TOTAL function (rule 3 of the events barrel): an event whose
 * target does not exist leaves the portfolio unchanged in CONTENT but not in
 * identity — the result is a fresh top-level object, structurally equal to
 * `p`, whose untouched sub-trees are shared (`updateById`/`removeById` return
 * the input array when the id is missing). So never test applicability with
 * `apply(p, e) === p`; nothing may rely on reference equality here.
 *
 * In the app an inapplicable event is never recorded — `decide` (commands/)
 * refuses the command first (see `Store.dispatch` in the app's `bindings/runtime.svelte.ts`);
 * totality here is what keeps undo/redo and replayed histories safe regardless.
 *
 * Correct results assume the invariant of `collections.ts`: ids unique per
 * collection. A truthful `before` is the emitter's concern, not `apply`'s.
 *
 * @see invert for the round-trip contract `apply(apply(p, e), invert(e)) ≡ p`.
 */
export const apply = (p: Portfolio, e: DomainEvent): Portfolio => {
  switch (e.type) {
    case 'ReviewFieldChanged':
      return { ...p, review: withField(p.review, e.field, e.after) }

    case 'IdentityFieldChanged':
      return {
        ...p,
        settings: { ...p.settings, identity: withField(p.settings.identity, e.field, e.after) },
      }

    case 'SettingChanged':
      return { ...p, settings: applySetting(p.settings, e) }

    case 'CategoryCreated':
      return { ...p, categories: insertAt(p.categories, e.index, e.category) }

    case 'CategoryDeleted':
      return { ...p, categories: removeById(p.categories, e.category.id) }

    case 'CategoryRenamed':
      return {
        ...p,
        categories: updateById(p.categories, e.id, (c) => ({ ...c, name: e.after })),
      }

    case 'CategoryRecolored':
      return {
        ...p,
        categories: updateById(p.categories, e.id, (c) => ({ ...c, color: e.after })),
      }

    case 'CategoryMoved':
      return { ...p, categories: moveById(p.categories, e.id, e.to) }

    case 'ProjectCreated':
      return { ...p, projects: insertAt(p.projects, e.index, e.project) }

    case 'ProjectDeleted':
      return { ...p, projects: removeById(p.projects, e.project.id) }

    case 'ProjectMoved':
      return { ...p, projects: moveById(p.projects, e.id, e.to) }

    case 'ProjectRenumbered':
      return {
        ...p,
        projects: updateById(p.projects, e.oldId, (pr) => ({ ...pr, id: e.newId })),
      }

    case 'ProjectFieldChanged':
      return {
        ...p,
        projects: updateById(p.projects, e.id, (pr) => withField(pr, e.field, e.after)),
      }

    case 'ProjectListChanged':
      return {
        ...p,
        projects: updateById(p.projects, e.id, (pr) => withField(pr, e.list, e.after)),
      }

    case 'ProjectMilestonesChanged':
      return {
        ...p,
        projects: updateById(p.projects, e.id, (pr) => ({ ...pr, milestones: e.after })),
      }

    case 'ProjectDecisionsChanged':
      return {
        ...p,
        projects: updateById(p.projects, e.id, (pr) => ({ ...pr, decisions: e.after })),
      }

    case 'FreeSlideCreated':
      return { ...p, freeSlides: insertAt(p.freeSlides, e.index, e.slide) }

    case 'FreeSlideDeleted':
      return { ...p, freeSlides: removeById(p.freeSlides, e.slide.id) }

    case 'FreeSlideChanged':
      return { ...p, freeSlides: updateById(p.freeSlides, e.id, () => e.after) }

    case 'FreeSlideMoved':
      return { ...p, freeSlides: moveById(p.freeSlides, e.id, e.to) }

    case 'PortfolioReplaced':
      return e.after

    case 'ProjectsMerged':
      // Same splice both ways (see `replaceSlice`): the event's slices carry
      // content AND position, so merging and unmerging are one algebra.
      return {
        ...p,
        categories: replaceSlice(p.categories, e.before.categories, e.after.categories),
        projects: replaceSlice(p.projects, e.before.projects, e.after.projects),
      }
  }
  // Exhaustiveness sentinel — unreachable while the union is covered.
  /* v8 ignore start */
  const _unreachable: never = e
  return p
  /* v8 ignore stop */
}
