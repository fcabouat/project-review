/**
 * Identifiers. An id is a string PROVED non-empty and typed per collection:
 * `CategoryId`, `ProjectId` and `FreeSlideId` are `string`s the compiler
 * refuses to mix up or fabricate — only the constructors here produce them
 * (the parse builds every stored id through them, the allocators mint fresh
 * ones). The import contract accepts any author-chosen id, so the motif is
 * simply "non-empty string"; uniqueness per collection is the parse's and the
 * allocators' concern, not the type's.
 *
 * Allocation is a pure counter + uniqueness scan — deterministic (same input,
 * same id) and collision-free whatever ids the parse or older sessions minted:
 * the scan starts at `existing.length + 1` and walks up to the first free
 * number. No `Date.now()` id: it would be neither reproducible under test nor
 * collision-free.
 *
 * PURE module: no clock, no dependency beyond the wrapper type.
 */
import type { Brand } from './refine'

/** Id of a `Category` (model/category.ts). */
export type CategoryId = Brand<string, 'CategoryId'>

/** Id of a project — same motif as {@link CategoryId}: any non-empty string. */
export type ProjectId = Brand<string, 'ProjectId'>

/** Id of a free slide — same motif as {@link CategoryId}. */
export type FreeSlideId = Brand<string, 'FreeSlideId'>

/** `undefined` on the empty string; any other string is a valid id. */
export const categoryId = (s: string): CategoryId | undefined =>
  s === '' ? undefined : (s as CategoryId)

/** `undefined` on the empty string; any other string is a valid id. */
export const projectId = (s: string): ProjectId | undefined =>
  s === '' ? undefined : (s as ProjectId)

/** `undefined` on the empty string; any other string is a valid id. */
export const freeSlideId = (s: string): FreeSlideId | undefined =>
  s === '' ? undefined : (s as FreeSlideId)

/**
 * The one sanctioned empty category reference — what `Project.categoryId`
 * holds while a project is unassigned. It resolves to no category, so the
 * project falls under the implicit "unsorted" group like any orphan; exports
 * keep serialising it as `""`, exactly as the import contract reads it.
 */
export const NO_CATEGORY = '' as CategoryId

/* ------------------------------------------------------------------ */
/* Allocation                                                          */
/* ------------------------------------------------------------------ */

/** Ids themselves, or the identified elements — callers hold the collection
 * and should not have to project it first. */
export type Existing = readonly (string | { readonly id: string })[]

const nextFree = (existing: Existing, idFor: (n: number) => string): string => {
  const used = new Set(existing.map((x) => (typeof x === 'string' ? x : x.id)))
  let n = existing.length + 1
  while (used.has(idFor(n))) n += 1
  return idFor(n)
}

/** Next free-slide id: `free-N` with the first free N. */
export const nextFreeSlideId = (existing: Existing): FreeSlideId =>
  nextFree(existing, (n) => `free-${n}`) as FreeSlideId

/** Next project id: `P-NN` (two digits) with the first free N. */
export const nextProjectId = (existing: Existing): ProjectId =>
  nextFree(existing, (n) => `P-${String(n).padStart(2, '0')}`) as ProjectId

/** Next category id: `category-N` with the first free N. */
export const nextCategoryId = (existing: Existing): CategoryId =>
  nextFree(existing, (n) => `category-${n}`) as CategoryId
