/**
 * WHY THIS FIXTURE. A seeded home-made PRNG (mulberry32) standing in for a
 * property-testing framework: the core keeps its zero-dependency promise even
 * in tests, and a failing random sequence replays IDENTICALLY from its seed —
 * a shrinking-free but reproducible property test.
 */

export type Rng = () => number

export const mulberry32 =
  (seed: number): Rng =>
  (): number => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

export const intBelow = (rng: Rng, n: number): number => Math.floor(rng() * n)

export const pick = <T>(rng: Rng, xs: readonly T[]): T => {
  const x = xs[intBelow(rng, xs.length)]
  if (x === undefined) throw new Error('pick on an empty list')
  return x
}
