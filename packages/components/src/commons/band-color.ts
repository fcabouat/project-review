/**
 * Progress band → theme CSS variable. THE single mapping, shared by the editor
 * gauges (SheetView range, ProjectsView bars) and by `ProgressGauge`: the ramp
 * thresholds live in `progressRamp`, the swatches live here, and neither is
 * ever restated at a call site.
 */
import type { ProgressBand } from '@project-review/core/projections'

/**
 * Band → `var(--av-*)` reference. Values are CSS variables, not hex: `app.css`
 * defines the tokens and the flat theme overrides them, so the mapping keeps
 * working under every style without knowing any pigment. `Record<ProgressBand,
 * …>` is the exhaustiveness guard — adding a band to the ramp fails compilation
 * right here until it gets a swatch.
 */
export const BAND_COLOR: Record<ProgressBand, string> = {
  red: 'var(--av-0)',
  orange: 'var(--av-1)',
  yellow: 'var(--av-34)',
  lightGreen: 'var(--av-67)',
  green: 'var(--av-100)',
  grey: 'var(--av-na)',
}
