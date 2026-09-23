/**
 * Single source for the stories: the REAL sample data set, run through the
 * total parse. No invented data in Storybook — what the catalog shows is
 * exactly what the deck will render.
 */
import rawSample from '@project-review/core/samples/sample-portfolio.fr.json'
import { parsePortfolio } from '@project-review/core/services/parse'
import { categoryOf } from '@project-review/core/projections'
import { catColor } from '../../src/commons/cat-color'
import type { Portfolio } from '@project-review/core/model/portfolio'
import type { Project } from '@project-review/core/model/project'

const result = parsePortfolio(rawSample)
if (!result.ok) throw new Error(`Unreadable sample data set: ${JSON.stringify(result.errors)}`)

export const sample: Portfolio = result.portfolio
export const reviewDate = sample.review.reviewDate
export const language = sample.settings.language

/** Project of the sample data set, by id — throws if the id disappears from it. */
export function project(id: string): Project {
  const p = sample.projects.find((p) => p.reference === id || p.id === id)
  if (!p) throw new Error(`Project ${id} missing from the sample data set`)
  return p
}

/** Category color resolved by the configured palette — never a hard-coded value. */
export function colorOf(projectId: string): string {
  const p = project(projectId)
  return catColor(categoryOf(sample, p.categoryId).color)
}

export function categoryColor(categoryId: string): string {
  return catColor(categoryOf(sample, categoryId).color)
}
