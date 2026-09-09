/**
 * Structural-copy helpers `apply` and `invert` build on — immutable, total,
 * and id-routed.
 *
 * INVARIANT — ids are unique per collection (categories, projects,
 * freeSlides): {@link updateById}/{@link removeById} take the FIRST match, so
 * `apply ∘ invert` breaks on duplicates (the inverse would hit the wrong
 * element). Not re-checked here: uniqueness is enforced upstream by the strict
 * parse, the id allocators (values/ids.ts) and the renumber guard.
 */

/**
 * Copy of `o` with one field redefined. An `undefined` value REMOVES the key —
 * without which the round trip would leave `{ health: undefined }` where the
 * original had no key at all.
 */
export const withField = <T extends object, F extends keyof T>(o: T, field: F, value: T[F]): T => {
  if (value === undefined) {
    const { [field]: _removed, ...rest } = o
    return rest as T
  }
  return { ...o, [field]: value }
}

const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max)

/** The one structural demand of the id-routed helpers. */
export interface Identified {
  readonly id: string
}

/** List left unchanged (same reference) if the id is not found — totality. */
export const updateById = <T extends Identified>(
  list: readonly T[],
  id: string,
  f: (x: T) => T,
): readonly T[] => {
  const i = list.findIndex((x) => x.id === id)
  return i < 0 ? list : list.map((x, j) => (j === i ? f(x) : x))
}

/** Insertion with the index clamped into the list — never throws. */
export const insertAt = <T>(list: readonly T[], index: number, x: T): readonly T[] => {
  const i = clamp(index, 0, list.length)
  return [...list.slice(0, i), x, ...list.slice(i)]
}

/** List left unchanged (same reference) if the id is not found — totality. */
export const removeById = <T extends Identified>(list: readonly T[], id: string): readonly T[] => {
  const i = list.findIndex((x) => x.id === id)
  return i < 0 ? list : [...list.slice(0, i), ...list.slice(i + 1)]
}

/** Removal by id then re-insertion at `to` (index within the amputated list). */
export const moveById = <T extends Identified>(
  list: readonly T[],
  id: string,
  to: number,
): readonly T[] => {
  const i = list.findIndex((x) => x.id === id)
  const x = list[i]
  // `list[-1]` is undefined: the one test covers the not-found case too.
  if (x === undefined) return list
  return insertAt([...list.slice(0, i), ...list.slice(i + 1)], to, x)
}

/** One element and the index it occupies in the array its slice describes. */
export interface Positioned<T> {
  readonly value: T
  readonly index: number
}

/**
 * Generalised splice — the algebra under `ProjectsMerged`: every id named by
 * either slice leaves the list, then the `into` entries are re-inserted at
 * their stated index, in ascending order (the standard reconstruction of a
 * multi-insertion: earlier insertions never disturb later indexes). Total like
 * its siblings: an absent id removes nothing, `insertAt` clamps. Swapping the
 * two slices is the exact inverse — untouched elements keep their relative
 * order, so the round trip restores the original array by construction.
 */
export const replaceSlice = <T extends Identified>(
  list: readonly T[],
  out: readonly Positioned<T>[],
  into: readonly Positioned<T>[],
): readonly T[] => {
  const gone = new Set([...out, ...into].map((x) => x.value.id))
  let next: readonly T[] = list.filter((x) => !gone.has(x.id))
  for (const { value, index } of [...into].sort((a, b) => a.index - b.index)) {
    next = insertAt(next, index, value)
  }
  return next
}
