/**
 * THE derivation — the full deck, plus the two per-slide choices
 * that shape it: whether a project earns its sheet, and how a divider lays out
 * its project list. Pure and deterministic: same portfolio, same deck.
 */
import type { FreeSlide } from '../model/free-slide'
import type { Portfolio } from '../model/portfolio'
import type { Project } from '../model/project'
import type { DecisionRef, Slide } from './slide'
import type { GroupRef } from './projects'
import { isTracked, knownCategoryIds, orphanProjects, projectsOfCategory } from './projects'
import { pendingDecisionsOf, decisionPages, previousDecisionPages } from './decisions'
import { recapPages } from './recap'
import { archivePages } from './archives'

/**
 * Whether the deck shows the project's sheet. Two deliberate subtleties:
 * `sheet: 'always'` wins even on an archived project (a still-visible archive),
 * and in 'auto' mode a pending decision triggers the sheet even when archived —
 * while that same decision stays out of the health dashboard, which reads
 * tracked projects only.
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
 *   + sheets — the divider only if the section has something to show) ·
 *   implicit "À classer" group · [decision pages] · [archives] ·
 *   [previous decisions] · closing free slides
 *
 * Bracketed slides depend on the `show` settings and on having content. Two
 * degradation rules keep entered content visible no matter what: a free slide
 * anchored before an EMPTY category is still emitted, and one anchored
 * on an UNKNOWN category joins the closing block instead of disappearing.
 *
 * Page numbers and the slideshow's drawer tree derive from this sequence.
 */
export function deck(p: Portfolio): readonly Slide[] {
  const slides: Slide[] = []
  const freeform = (keep: (s: FreeSlide) => boolean) => {
    for (const s of p.freeSlides) if (keep(s)) slides.push({ type: 'freeform', slideId: s.id })
  }
  const projectPages = (type: 'recap' | 'archives', pages: readonly (readonly Project[])[]) => {
    pages.forEach((page, i) =>
      slides.push({
        type,
        page: i + 1,
        totalPages: pages.length,
        projectIds: page.map((pr) => pr.id),
      }),
    )
  }
  const decisionPagesOf = (
    type: 'decisions' | 'previousDecisions',
    pages: readonly (readonly DecisionRef[])[],
  ) => {
    pages.forEach((entries, i) =>
      slides.push({ type, page: i + 1, totalPages: pages.length, entries }),
    )
  }

  slides.push({ type: 'title' })
  freeform((s) => s.anchor.type === 'opening')
  slides.push({ type: 'portfolioDashboard' })
  if (p.settings.show.healthDashboard) slides.push({ type: 'healthDashboard' })

  if (p.settings.show.recap) projectPages('recap', recapPages(p))

  let number = 0
  const categoryGroup = (group: GroupRef, projects: readonly Project[]): void => {
    // A section can contain tracked projects, archived sheets, or both.
    const sheets = projects.filter(showsSheet)
    if (!projects.some(isTracked) && sheets.length === 0) return
    number += 1
    slides.push({ type: 'divider', group, number })
    for (const pr of sheets) slides.push({ type: 'sheet', projectId: pr.id })
  }
  for (const c of p.categories) {
    // Emitted even if the category is empty: entered content never vanishes silently.
    freeform((s) => s.anchor.type === 'beforeCategory' && s.anchor.categoryId === c.id)
    categoryGroup({ kind: 'category', id: c.id }, projectsOfCategory(p, c.id))
  }
  // The orphan group follows real categories and has a distinct reference kind.
  categoryGroup({ kind: 'orphans' }, orphanProjects(p))

  if (p.settings.show.decisions) {
    decisionPagesOf('decisions', decisionPages(p))
  }

  if (p.settings.show.archives) projectPages('archives', archivePages(p))

  // Final appendix, apart from closing free slides; no empty page is emitted.
  if (p.settings.show.decisions) {
    decisionPagesOf('previousDecisions', previousDecisionPages(p))
  }

  // An unresolved category anchor joins the closing block.
  const known = knownCategoryIds(p)
  freeform(
    (s) =>
      s.anchor.type === 'closing' ||
      (s.anchor.type === 'beforeCategory' && !known.has(s.anchor.categoryId)),
  )
  return slides
}
