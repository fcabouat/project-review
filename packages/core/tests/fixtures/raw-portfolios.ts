/**
 * WHY THIS FIXTURE. Minimal VALID raw portfolios for the strict parse — the
 * JSON-side twin of `hand-built-portfolios.ts` (which builds typed values).
 * The parse refuses anything incomplete, so a test cannot probe ONE fault
 * with a two-line object: it starts from these smallest-that-still-parse
 * builders and overrides only the field under test — every refusal asserted
 * is then attributable to that override alone.
 */

/** A complete, contract-valid raw project; spread overrides on top. */
export const rawProject = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'P-01',
  name: 'X',
  categoryId: '',
  stage: 'toScope',
  onHold: false,
  goal: 'o',
  done: [],
  ongoing: [],
  next: [],
  decisions: [],
  milestones: [],
  sheet: 'auto',
  ...over,
})

/** A complete, contract-valid raw portfolio; spread overrides on top. */
export const rawPortfolio = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: 4,
  review: { title: 't', reviewDate: '2026-01-01' },
  settings: {
    identity: { org: 'a', unit: 'b' },
    show: { healthDashboard: true, recap: true, archives: true, decisions: true },
    recapRows: 11,
  },
  categories: [],
  projects: [],
  freeSlides: [],
  ...over,
})
