/**
 * Project predicates, order and lookups — the vocabulary
 * every other derivation builds on. Pure, total, deterministic.
 */
import type { Category, UnsortedCategory } from '../model/category'
import { UNSORTED_CATEGORY } from '../model/category'
import type { Portfolio } from '../model/portfolio'
import type { Project } from '../model/project'
import { ARCHIVED_STAGES, PRE_PROJECT_STAGES } from '../model/project'
import type { Language } from '../model/theme'
import { t } from '../services/i18n'

/**
 * 'closed' or 'abandoned' — out of every KPI, dashboard and recap;
 * such a project only surfaces on the archives slide (and on its own sheet when
 * `sheet: 'always'` keeps it visible).
 */
export function isArchived(p: Project): boolean {
  return ARCHIVED_STAGES.includes(p.stage)
}

/** Complement of {@link isArchived} — the population every figure counts over.
 * 'residuals' still tracks: done is not gone while leftovers remain. */
export function isTracked(p: Project): boolean {
  return !isArchived(p)
}

/** 'toScope' or 'ready' — not launched yet: no gauge (pitfall n° 3) and its
 * own segment on the D1 bars. */
export function isPreProject(p: Project): boolean {
  return PRE_PROJECT_STAGES.includes(p.stage)
}

/** Resolved category; falls back to the unsorted sentinel for an orphan id. */
export function categoryOf(p: Portfolio, categoryId: string): Category | UnsortedCategory {
  return p.categories.find((c) => c.id === categoryId) ?? UNSORTED_CATEGORY
}

/** Plain linear lookup — how templates resolve the `projectId` a slide
 * carries; `undefined` means the slide outlived its project. */
export function projectById(p: Portfolio, id: string): Project | undefined {
  return p.projects.find((x) => x.id === id)
}

/**
 * Portfolio order: categories in their order, then the projects of each
 * category in their relative order; orphans close the march.
 */
export function orderedProjects(p: Portfolio): readonly Project[] {
  const byCategory: Project[] = []
  for (const c of p.categories) {
    for (const pr of p.projects) if (pr.categoryId === c.id) byCategory.push(pr)
  }
  return [...byCategory, ...orphanProjects(p)]
}

/** Projects of one category, in their stored (= displayed) relative order.
 * Archived ones included — callers filter with {@link isTracked} when needed. */
export function projectsOfCategory(p: Portfolio, categoryId: string): readonly Project[] {
  return p.projects.filter((pr) => pr.categoryId === categoryId)
}

/** The ids a `categoryId` reference can resolve against. */
export function knownCategoryIds(p: Portfolio): ReadonlySet<string> {
  return new Set(p.categories.map((c) => c.id))
}

/** Projects whose `categoryId` resolves to no category — the "À classer" residue. */
export function orphanProjects(p: Portfolio): readonly Project[] {
  const known = knownCategoryIds(p)
  return p.projects.filter((pr) => !known.has(pr.categoryId))
}

/**
 * Status text of a project — stage label plus the "· on hold" suffix. The
 * suffix is dropped on an ARCHIVED project on purpose: a leftover `onHold` flag
 * says nothing once the project is closed, and "Clos · en attente" would read
 * as a contradiction.
 */
export function displayedStatus(pr: Project, language: Language): string {
  const base = t(`stage.${pr.stage}`, language)
  return pr.onHold && isTracked(pr) ? `${base} ${t('stage.onHold', language)}` : base
}
