/**
 * Projections — pure READ-MODELS over the portfolio: the deck and
 * every displayed figure are recomputed here, never stored (law 3), and no
 * mutation ever starts here — the writes go through commands/. Total (law 2),
 * deterministic (law 1: the only reference date is `review.reviewDate`).
 *
 * One module per projection theme; consumers import from this barrel:
 *
 *   slide.ts       deck vocabulary (Slide, DecisionRef) — types only
 *   projects.ts    project predicates, order, lookups  ← projects, categories
 *   milestones.ts  milestone state, next milestone     ← milestones, reviewDate
 *   gauges.ts      progress gauge, risks band          ← one project
 *   decisions.ts   pending/taken refs, decision pages  ← projects, reviewDate
 *   kpis.ts        dashboard tiles, bars and counters  ← tracked projects
 *   recap.ts       recap pages                         ← tracked projects, settings
 *   deck.ts        THE deck (slide sequence)           ← the whole portfolio
 *   deck-tree.ts   deck folded into slideshow drawers  ← deck.ts
 */
export * from './slide'
export * from './projects'
export * from './milestones'
export * from './gauges'
export * from './decisions'
export * from './kpis'
export * from './recap'
export * from './deck'
export * from './deck-tree'
