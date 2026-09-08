/**
 * `completeMerge` — the handler of the {@link MergeProjects} use-case, split
 * out of `decide` because completing a merge means computing POSITIONS, not
 * just reading a `before`. The rules it encodes (the merge contract):
 *
 *  - upsert by id — an incoming project replaces its homonym IN PLACE (same
 *    position), a new id joins the END of its category;
 *  - an unknown incoming category is appended at the end; a homonym category
 *    keeps the PRESENT version — the owner owns the taxonomy, only the
 *    `categoryId` reference of the incoming projects counts;
 *  - a merge never deletes anything;
 *  - refusal (`undefined`) only for a merge STRICTLY void of effect: no
 *    incoming project, or every incoming project structurally equal to its
 *    present homonym. Anything else emits.
 *
 * Uniqueness of ids within the incoming arrays is the emitter's concern —
 * they come from a strictly parsed file, which enforces it (same trust
 * boundary as `apply`'s, collections.ts).
 *
 * PURE module: no Svelte/DOM import, no clock, no mutation.
 */
import type { Portfolio } from '../model/portfolio'
import type { Project } from '../model/project'
import type { MergeSlice, ProjectsMerged } from '../events/portfolio'
import type { Positioned } from '../events/collections'
import type { MergeProjects } from './portfolio'

/** Structural equality over parse-produced values (plain JSON trees). */
const equal = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => equal(x, b[i]))
    )
  }
  const ka = Object.keys(a)
  const kb = new Set(Object.keys(b))
  return (
    ka.length === kb.size &&
    ka.every(
      (k) =>
        kb.has(k) && equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  )
}

/** The final projects array: homonyms swapped in place, new ids inserted at
 * the end of their category (at the very end when the category holds none). */
const mergedProjects = (present: readonly Project[], incoming: readonly Project[]): Project[] => {
  const arriving = new Map(incoming.map((x) => [x.id as string, x]))
  const merged = present.map((x) => arriving.get(x.id) ?? x)
  for (const x of incoming) {
    if (present.some((y) => y.id === x.id)) continue
    const last = merged.findLastIndex((y) => y.categoryId === x.categoryId)
    merged.splice(last === -1 ? merged.length : last + 1, 0, x)
  }
  return merged
}

/**
 * Completes a merge intent against the present portfolio, or refuses a merge
 * strictly void of effect (module header). Both slices of the produced event
 * are true by construction: `before` is read from `p`, `after`'s indexes are
 * computed on the exact array `apply` will rebuild.
 */
export const completeMerge = (p: Portfolio, c: MergeProjects): ProjectsMerged | undefined => {
  if (c.projects.length === 0) return undefined

  const presentAt = new Map(p.projects.map((x, index) => [x.id as string, { value: x, index }]))
  const replaced = c.projects.flatMap((x) => {
    const hit = presentAt.get(x.id)
    return hit === undefined ? [] : [hit]
  })
  if (
    replaced.length === c.projects.length &&
    c.projects.every((x) => equal(x, presentAt.get(x.id)?.value))
  ) {
    return undefined
  }

  // Concerned existing categories: identical on both sides (the present won).
  const kept = c.categories.flatMap((x) => {
    const index = p.categories.findIndex((y) => y.id === x.id)
    return index === -1 ? [] : [{ value: p.categories[index]!, index }]
  })
  const created = c.categories
    .filter((x) => !p.categories.some((y) => y.id === x.id))
    .map((value, k) => ({ value, index: p.categories.length + k }))

  const final = mergedProjects(p.projects, c.projects)
  const finalAt = new Map(final.map((x, i) => [x.id as string, i]))
  const after: MergeSlice = {
    projects: c.projects.map((value): Positioned<Project> => ({
      value,
      index: finalAt.get(value.id)!,
    })),
    categories: [...kept, ...created],
  }

  return {
    type: 'ProjectsMerged',
    before: { projects: replaced, categories: kept },
    after,
  }
}
