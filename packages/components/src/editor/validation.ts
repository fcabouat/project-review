/**
 * Soft validation — improbable but PERMITTED field combinations. They earn
 * a warning badge, never a block: the deck renders them as they are (P3), and
 * no event is ever refused because of them.
 *
 * PURE module: no Svelte, no DOM, no clock — the only reference date remains
 * `review.reviewDate`, and none of these rules needs it.
 */
import type { Portfolio } from '@project-review/core/model/portfolio'
import type { Project } from '@project-review/core/model/project'
import { isArchived } from '@project-review/core/projections'
import type { LabelKey } from '../i18n'

/** A warning is an i18n key plus its slots — never a pre-baked sentence. */
export interface SoftWarning {
  readonly key: LabelKey
  readonly slots?: Readonly<Record<string, string | number>>
}

/** The five project-level combinations of the contract, in a stable order. */
export function projectWarnings(project: Project): readonly SoftWarning[] {
  const warnings: SoftWarning[] = []
  const settled = project.stage === 'residuals' || project.stage === 'closed'

  if (project.progress === 100 && !settled) {
    warnings.push({ key: 'editor.check.progress100' })
  }
  if (project.health !== undefined && isArchived(project)) {
    warnings.push({ key: 'editor.check.healthOnArchived' })
  }
  if (project.onHold && project.stage === 'toScope') {
    warnings.push({ key: 'editor.check.onHoldOnScoping' })
  }
  if (isArchived(project) && project.decisions.some((d) => d.taken === undefined)) {
    warnings.push({ key: 'editor.check.decisionOnArchived' })
  }
  if (project.actualEnd !== undefined && !settled) {
    warnings.push({ key: 'editor.check.actualEndWithoutStage' })
  }
  return warnings
}

/** The sixth combination lives on the portfolio, not on a project. */
export function portfolioWarnings(portfolio: Portfolio): readonly SoftWarning[] {
  const seen = new Set<string>()
  const warned = new Set<string>()
  const warnings: SoftWarning[] = []
  for (const category of portfolio.categories) {
    // ONE warning per shared color, however many categories share it.
    if (seen.has(category.color) && !warned.has(category.color)) {
      warnings.push({ key: 'editor.check.duplicateColor', slots: { color: category.color } })
      warned.add(category.color)
    }
    seen.add(category.color)
  }
  return warnings
}
