/**
 * Sheet-tile derivations — the progress gauge and the risks band,
 * computed here so no view ever assembles them.
 */
import type { Project } from '../model/project'
import { isPreProject } from './projects'

/** Color band of the progress ramp — 'grey' is the "not assessed" band, kept in
 * the union so `BAND_COLOR` (ui) covers it by exhaustiveness. */
export type ProgressBand = 'red' | 'orange' | 'yellow' | 'lightGreen' | 'green' | 'grey'

/** Thresholds tunable in one single place: 0 · 1–33 · 34–66 · 67–99 · 100. */
export function progressRamp(a: number | undefined): ProgressBand {
  if (a === undefined) return 'grey'
  if (a <= 0) return 'red'
  if (a <= 33) return 'orange'
  if (a <= 66) return 'yellow'
  if (a <= 99) return 'lightGreen'
  return 'green'
}

/** What the progress tile renders: an em-dash ('notAssessed') or a percentage
 * with its band — computed by {@link projectGauge}, never assembled by views. */
export type Gauge =
  | { readonly type: 'notAssessed' }
  | { readonly type: 'value'; readonly pct: number; readonly band: ProgressBand }

/** Pitfall n° 3: no progress before launch, whatever the form captured. */
export function projectGauge(pr: Project): Gauge {
  if (isPreProject(pr) || pr.progress === undefined) return { type: 'notAssessed' }
  return { type: 'value', pct: pr.progress, band: progressRamp(pr.progress) }
}

/** Tone of the sheet's risks band: a `HealthLevel` plus 'neutral' for the
 * no-risks "RAS" state (which is calmer than 'onTrack', not equal to it). */
export type RisksBand = 'neutral' | 'onTrack' | 'watch' | 'alert' | 'critical'

/**
 * Tone of the sheet's risks band: no risks text →
 * neutral "RAS"; otherwise the health level gives the band its own title —
 * an unassessed or confident project with risks text reads as "Confiance".
 */
export function risksLevel(pr: Project): RisksBand {
  if (pr.risks === undefined || pr.risks === '') return 'neutral'
  if (pr.health === 'watch' || pr.health === 'alert' || pr.health === 'critical') return pr.health
  return 'onTrack'
}
