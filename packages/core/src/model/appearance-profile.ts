import type { Portfolio, Settings } from './portfolio'
import type { Category } from './category'

/** Portable appearance, deliberately excluding review and project content. */
export interface AppearanceProfile {
  readonly format: 'project-review-appearance'
  readonly version: 1
  readonly settings: Settings
  readonly categories: readonly Category[]
}

/** Profiles use an empty content frame for validation, never for replacement. */
export interface ImportSource {
  readonly kind: 'portfolio' | 'appearance'
  readonly portfolio: Portfolio
}
