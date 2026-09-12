/**
 * WHY THIS FIXTURE. The smallest contract-valid category and project, with
 * spread overrides on top: the soft-validation rules judge COMBINATIONS of
 * fields, so each test states only the combination under scrutiny — a plain
 * `project({ stage: 'closed', health: 'onTrack' })` reads as the rule it
 * probes, and the baseline earns zero warnings by construction.
 */
import type { Category } from '@project-review/core/model/category'
import type { Project } from '@project-review/core/model/project'
import { categoryId, projectId } from '@project-review/core/values/ids'

export const category = (id: string, color: Category['color']): Category => ({
  id: categoryId(id)!,
  name: id,
  color,
})

export const project = (extra: Partial<Project>): Project => ({
  id: projectId('P-01')!,
  name: 'X',
  categoryId: categoryId('c')!,
  stage: 'inProgress',
  onHold: false,
  goal: 'o',
  done: [],
  ongoing: [],
  next: [],
  decisions: [],
  milestones: [],
  sheet: 'auto',
  ...extra,
})
