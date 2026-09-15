/** Pure presentation geometry for chronologically sorted milestone dates. */
const LEFT = 12
const RIGHT = 88
const MIN_GAP = 14

const day = (date: string): number => Date.parse(`${date}T00:00:00Z`) / 86_400_000

/**
 * Blend the true time scale toward evenly spaced points only as much as needed
 * to guarantee a readable minimum gap. Six milestones fit without a packing
 * engine. Dates on the same day keep input order and get separate markers.
 * The review cursor follows the SAME adjusted scale, interpolating between
 * distinct dates (the midpoint of a same-day group represents that date).
 * Dates are validated ISO dates, sorted by the caller.
 */
export function timelineLayout(dates: readonly string[], reviewDate: string) {
  if (dates.length === 0) return { positions: [], staggered: false, adjusted: false }
  const days = dates.map(day)
  const first = days[0]!
  const last = days[days.length - 1]!
  const span = last - first
  const linear = days.map((d) => (span === 0 ? 50 : LEFT + ((d - first) / span) * (RIGHT - LEFT)))
  const step = dates.length === 1 ? 0 : (RIGHT - LEFT) / (dates.length - 1)
  const gap = Math.min(MIN_GAP, step)
  let blend = 0
  for (let i = 1; i < linear.length; i += 1) {
    const actualGap = linear[i]! - linear[i - 1]!
    if (actualGap < gap) blend = Math.max(blend, (gap - actualGap) / (step - actualGap))
  }
  const positions = linear.map((p, i) => p * (1 - blend) + (LEFT + i * step) * blend)
  const staggered = positions.some((p, i) => i > 0 && p - positions[i - 1]! < 26)

  const groups: { date: number; left: number; count: number }[] = []
  days.forEach((date, i) => {
    const previous = groups.at(-1)
    if (previous?.date === date) {
      previous.left += positions[i]!
      previous.count += 1
    } else groups.push({ date, left: positions[i]!, count: 1 })
  })
  groups.forEach((g) => (g.left /= g.count))
  const review = day(reviewDate)
  let cursor: number | undefined
  for (let i = 0; i < groups.length; i += 1) {
    const current = groups[i]!
    const next = groups[i + 1]
    if (review === current.date) cursor = current.left
    else if (next && review > current.date && review < next.date) {
      cursor =
        current.left +
        ((review - current.date) / (next.date - current.date)) * (next.left - current.left)
    }
  }
  return { positions, staggered, adjusted: blend > 0, cursor }
}
