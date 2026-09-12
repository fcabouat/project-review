/**
 * Timeline geometry — pure presentation (positions in %), no domain: no
 * business rule here, only the projection of a date onto an axis.
 * LINEAR scale in time, bounded to [8 %, 92 %]: the margins let the extreme
 * labels breathe without clipping them at the frame edge.
 */

/** Position (%) of the earliest date — the left breathing margin. */
export const LEFT_BOUND = 8
/** Position (%) of the latest date — mirror of {@link LEFT_BOUND}. */
export const RIGHT_BOUND = 92

/**
 * Days elapsed since the epoch, from an ISO date YYYY-MM-DD (UTC: no time
 * zone). Total: a malformed date folds to day 0 rather than NaN, so downstream
 * arithmetic stays finite — the parse upstream makes that case theoretical.
 */
export function absoluteDay(iso: string): number {
  const [y, m, d] = iso.split('-')
  const n = Date.UTC(Number(y), Number(m) - 1, Number(d))
  return Number.isNaN(n) ? 0 : n / 86_400_000
}

/** Axis window in {@link absoluteDay} units (days, not dates or percents). */
export interface Scale {
  readonly min: number
  readonly max: number
}

/**
 * Window spanning the given dates, in any order. `undefined` for an empty
 * list — "no timeline at all", which callers must distinguish from the
 * one-date degenerate scale (span 0, everything centred by `positionPct`).
 */
export function scaleOf(isoDates: readonly string[]): Scale | undefined {
  if (isoDates.length === 0) return undefined
  const days = isoDates.map(absoluteDay)
  return { min: Math.min(...days), max: Math.max(...days) }
}

/** Position in % within [8, 92]; degenerate scale (a single date) → middle. */
export function positionPct(iso: string, s: Scale): number {
  const span = s.max - s.min
  if (span <= 0) return (LEFT_BOUND + RIGHT_BOUND) / 2
  const r = (absoluteDay(iso) - s.min) / span
  return LEFT_BOUND + r * (RIGHT_BOUND - LEFT_BOUND)
}

/** The review cursor is only drawn if it falls inside the milestone window. */
export function withinScale(iso: string, s: Scale): boolean {
  const d = absoluteDay(iso)
  return d >= s.min && d <= s.max
}

/**
 * Staggering: decided by geometry, not by a setting. As soon as two neighbouring
 * points are less than 12 % apart, their labels overlap — so we alternate them
 * above / below the axis.
 */
export const MIN_GAP_PCT = 12

/**
 * `true` when any two CONSECUTIVE positions sit closer than
 * {@link MIN_GAP_PCT}. Callers pass positions in axis order (milestones come
 * date-sorted); one crowded pair flips the WHOLE timeline to alternating
 * labels — mixing staggered and aligned labels on one axis would look broken.
 */
export function needsStagger(positions: readonly number[]): boolean {
  for (let i = 1; i < positions.length; i += 1) {
    const a = positions[i - 1]
    const b = positions[i]
    if (a !== undefined && b !== undefined && b - a < MIN_GAP_PCT) return true
  }
  return false
}
