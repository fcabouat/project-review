import type { Portfolio } from '../model/portfolio'
import type { AppearanceProfile, ImportSource } from '../model/appearance-profile'
import { NO_CATEGORY } from '../values/ids'
import type { CategoryId } from '../values/ids'

/** A reusable appearance file carries no review, projects or free slides. */
export const appearanceProfile = (p: Portfolio): AppearanceProfile => ({
  format: 'project-review-appearance',
  version: 1,
  settings: p.settings,
  categories: p.categories,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const IMPORT_BLOCKS = ['review', 'language', 'identity', 'theme', 'display'] as const
export type ImportBlock = (typeof IMPORT_BLOCKS)[number]
export const IMPORT_COLLECTIONS = ['categories', 'projects', 'freeSlides'] as const
export type ImportCollection = (typeof IMPORT_COLLECTIONS)[number]
export interface ImportResolution {
  readonly collection: ImportCollection
  readonly id: string
  readonly action: 'replace' | 'copy'
  /** Minted once at the application boundary, reused by preview and confirmation. */
  readonly copyId?: string
}
export interface ImportSelection {
  readonly blocks: readonly ImportBlock[]
  readonly categories: readonly string[]
  readonly projects: readonly string[]
  readonly freeSlides: readonly string[]
  readonly resolutions?: readonly ImportResolution[]
  readonly categoryLinks?: readonly { readonly sourceId: string; readonly targetId: CategoryId }[]
}

/** Nothing is selected implicitly when mixing a full portfolio. */
export const emptyImportSelection = (): ImportSelection => ({
  blocks: [],
  categories: [],
  projects: [],
  freeSlides: [],
})

function upsert<T extends { readonly id: string }>(
  present: readonly T[],
  incoming: readonly T[],
  ids: readonly string[],
  resolutions: readonly ImportResolution[],
): readonly T[] {
  const selected = new Set(ids)
  const known = new Set(present.map((x) => x.id))
  const arrivals = new Map<string, T>()
  const copies: T[] = []
  for (const item of incoming) {
    if (!selected.has(item.id)) continue
    const choice = resolutions.find((r) => r.id === item.id)
    if (choice?.action === 'copy' && choice.copyId) {
      // Do not deduplicate copies: a malformed plan must fail the final portfolio contract.
      copies.push({ ...item, id: choice.copyId })
    } else if (!known.has(item.id) || choice?.action === 'replace') {
      arrivals.set(item.id, item)
    }
  }
  return [
    ...present.map((x) => arrivals.get(x.id) ?? x),
    ...[...arrivals.values()].filter((x) => !known.has(x.id)),
    ...copies,
  ]
}

/** Mixed imports are additions/replacements only; unselected data never changes. */
export function mixPortfolio(
  p: Portfolio,
  source: ImportSource,
  selected: ImportSelection,
): Portfolio {
  const incoming = source.portfolio
  const has = (block: ImportBlock): boolean => selected.blocks.includes(block)
  const full = source.kind === 'portfolio'
  const choices = (key: ImportCollection) =>
    (selected.resolutions ?? []).filter((r) => r.collection === key)
  const category = (id: CategoryId): CategoryId =>
    selected.categories.includes(id)
      ? (selected.categoryLinks?.find((r) => r.sourceId === id)?.targetId ?? id)
      : id
  const categoryIds = selected.categories.filter(
    (id) => !selected.categoryLinks?.some((r) => r.sourceId === id),
  )
  return {
    ...p,
    review: full && has('review') ? incoming.review : p.review,
    settings: {
      ...p.settings,
      ...(has('language') ? { language: incoming.settings.language } : {}),
      ...(has('identity') ? { identity: incoming.settings.identity } : {}),
      ...(has('theme') ? { theme: incoming.settings.theme } : {}),
      ...(has('display')
        ? {
            show: incoming.settings.show,
            recapRows: incoming.settings.recapRows,
            navigation: incoming.settings.navigation,
          }
        : {}),
    },
    categories: upsert(p.categories, incoming.categories, categoryIds, choices('categories')),
    projects: full
      ? upsert(
          p.projects,
          incoming.projects.map((x) => ({ ...x, categoryId: category(x.categoryId) })),
          selected.projects,
          choices('projects'),
        )
      : p.projects,
    freeSlides: full
      ? upsert(
          p.freeSlides,
          incoming.freeSlides.map((x) => ({
            ...x,
            anchor:
              x.anchor.type === 'beforeCategory'
                ? { ...x.anchor, categoryId: category(x.anchor.categoryId) }
                : x.anchor,
          })),
          selected.freeSlides,
          choices('freeSlides'),
        )
      : p.freeSlides,
  }
}

/** Plain JSON equality ignores key order and absent optional properties. */
export function sameImportValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (!isRecord(a) || !isRecord(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => sameImportValue(x, b[i]))
    )
  }
  const keys = Object.keys(a).filter((key) => a[key] !== undefined)
  const other = Object.keys(b).filter((key) => b[key] !== undefined)
  return keys.length === other.length && keys.every((key) => sameImportValue(a[key], b[key]))
}

export interface ImportSummary {
  readonly added: number
  readonly replaced: number
  readonly removed: number
  readonly blocks: readonly ImportBlock[]
  readonly missingCategories: readonly string[]
  readonly reordered: readonly ImportCollection[]
}

/** Preview is computed from the exact candidate later submitted as one undoable edit. */
export function importSummary(before: Portfolio, after: Portfolio): ImportSummary {
  let added = 0
  let replaced = 0
  let removed = 0
  const reordered: ImportCollection[] = []
  for (const key of IMPORT_COLLECTIONS) {
    const present = new Map(before[key].map((x) => [x.id, x]))
    const future = new Set(after[key].map((x) => x.id))
    if (
      !sameImportValue(
        before[key].filter((x) => future.has(x.id)).map((x) => x.id),
        after[key].filter((x) => present.has(x.id)).map((x) => x.id),
      )
    )
      reordered.push(key)
    for (const item of after[key]) {
      if (!present.has(item.id)) added += 1
      else if (!sameImportValue(item, present.get(item.id))) replaced += 1
    }
    removed += before[key].filter((x) => !future.has(x.id)).length
  }
  const display = (p: Portfolio) => ({
    show: p.settings.show,
    recapRows: p.settings.recapRows,
    navigation: p.settings.navigation ?? 'sections',
  })
  const blocks = IMPORT_BLOCKS.filter(
    (key) =>
      !sameImportValue(
        key === 'review'
          ? before.review
          : key === 'display'
            ? display(before)
            : before.settings[key],
        key === 'review' ? after.review : key === 'display' ? display(after) : after.settings[key],
      ),
  )
  const known = new Set(after.categories.map((x) => x.id))
  const missingCategories = [
    ...new Set(
      [
        ...after.projects.map((x) => x.categoryId),
        ...after.freeSlides.flatMap((x) =>
          x.anchor.type === 'beforeCategory' ? [x.anchor.categoryId] : [],
        ),
      ].filter((id) => id !== NO_CATEGORY && !known.has(id)),
    ),
  ]
  return { added, replaced, removed, blocks, missingCategories, reordered }
}
