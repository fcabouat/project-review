/**
 * THE derivation — the full deck, plus the two per-slide choices
 * that shape it: whether a project earns its sheet, and how a divider lays out
 * its project list. Pure and deterministic: same portfolio, same deck.
 */
import type { FreeSlide } from '../model/free-slide'
import type { Portfolio } from '../model/portfolio'
import type { Project } from '../model/project'
import type { Slide } from './slide'
import { UNSORTED_CATEGORY } from '../model/category'
import {
  isArchived,
  isTracked,
  knownCategoryIds,
  orphanProjects,
  projectsOfCategory,
} from './projects'
import { pendingDecisionsOf, decisionPages, takenDecisionsSinceLastReview } from './decisions'
import { recapPages } from './recap'

/**
 * Whether the deck shows the project's sheet. Two deliberate subtleties:
 * `sheet: 'always'` wins even on an archived project (a still-visible archive),
 * and in 'auto' mode a pending decision triggers the sheet even when archived —
 * while that same decision stays out of D2, which reads tracked projects only.
 */
export function showsSheet(p: Project): boolean {
  if (p.sheet === 'always') return true
  if (p.sheet === 'never') return false
  return (
    p.stage === 'ready' ||
    p.stage === 'inProgress' ||
    p.stage === 'residuals' ||
    pendingDecisionsOf(p).length > 0
  )
}

/** Layout of a divider's project list — geometry only, chosen from the count
 * by {@link dividerMode}; a divider never paginates. */
export type DividerMode = 'normal' | 'compact' | 'truncated'

/** Normal list ≤ 5 projects, compact (2 columns) 6–10, truncated beyond. */
export function dividerMode(projectCount: number): DividerMode {
  if (projectCount <= 5) return 'normal'
  if (projectCount <= 10) return 'compact'
  return 'truncated'
}

/**
 * THE derivation — the full deck, in the contract order:
 *
 *   title · opening free slides · portfolio dashboard · [health dashboard] ·
 *   [recap pages] · per category: (free slides anchored before it, then divider
 *   + sheets — the divider only if the category has a TRACKED project) ·
 *   implicit "À classer" group · [decision pages] · [archives] ·
 *   [previous decisions] · closing free slides
 *
 * Bracketed slides depend on the `show` settings and on having content. Two
 * degradation rules keep entered content visible no matter what: a free slide
 * anchored before an EMPTY category is still emitted, and one anchored
 * on an UNKNOWN category joins the closing block instead of disappearing.
 *
 * Pure and deterministic: same portfolio, same deck — the sheet count in a
 * divider, the printed page numbers and the slideshow all re-derive from this
 * one function (via `deckTree` for the drawer grouping) and can never disagree.
 */
export function deck(p: Portfolio): readonly Slide[] {
  const slides: Slide[] = []
  const freeform = (keep: (s: FreeSlide) => boolean) => {
    for (const s of p.freeSlides) if (keep(s)) slides.push({ type: 'freeform', slideId: s.id })
  }

  slides.push({ type: 'title' })
  freeform((s) => s.anchor.type === 'opening')
  slides.push({ type: 'portfolioDashboard' })
  if (p.settings.show.healthDashboard) slides.push({ type: 'healthDashboard' })

  if (p.settings.show.recap) {
    const pages = recapPages(p)
    pages.forEach((page, i) =>
      slides.push({
        type: 'recap',
        page: i + 1,
        totalPages: pages.length,
        projectIds: page.map((pr) => pr.id),
      }),
    )
  }

  let number = 0
  const categoryGroup = (categoryId: string, projects: readonly Project[]): void => {
    if (!projects.some(isTracked)) return
    number += 1
    slides.push({ type: 'divider', categoryId, number })
    for (const pr of projects) {
      if (showsSheet(pr)) slides.push({ type: 'sheet', projectId: pr.id })
    }
  }
  for (const c of p.categories) {
    // Emitted even if the category is empty: entered content never vanishes silently.
    freeform((s) => s.anchor.type === 'beforeCategory' && s.anchor.categoryId === c.id)
    categoryGroup(c.id, projectsOfCategory(p, c.id))
  }
  // Implicit "À classer" group: tracked orphans get their divider and sheets
  // AFTER the real categories — a broken id never hides a project.
  categoryGroup(UNSORTED_CATEGORY.id, orphanProjects(p))

  if (p.settings.show.decisions) {
    const pages = decisionPages(p)
    pages.forEach((page, i) =>
      slides.push({ type: 'decisions', page: i + 1, totalPages: pages.length, entries: page }),
    )
  }

  if (p.settings.show.archives && p.projects.some(isArchived)) {
    slides.push({ type: 'archives' })
  }

  // Very last slide, apart from closing free slides.
  if (
    p.settings.show.decisions &&
    p.review.previousReviewDate &&
    takenDecisionsSinceLastReview(p).length > 0
  ) {
    slides.push({ type: 'previousDecisions' })
  }

  // An anchor on an unknown category never swallows the slide: it degrades to
  // the closing position, like the parse fallback for a malformed anchor.
  const known = knownCategoryIds(p)
  freeform(
    (s) =>
      s.anchor.type === 'closing' ||
      (s.anchor.type === 'beforeCategory' && !known.has(s.anchor.categoryId)),
  )
  return slides
}
