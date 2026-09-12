/**
 * Pins the dashboard figures (`src/projections/kpis.ts`) — EXACT acceptance
 * values on both sample data sets. If a figure does not match, the code is
 * wrong, not this file.
 */
import { describe, expect, it } from 'vitest'
import { CATALOG_FR } from '../../src/data/catalog.fr'
import { CATALOG_EN } from '../../src/data/catalog.en'
import { categoryBars, groupKey, healthBreakdown, kpis } from '../../src/projections/index'
import { rawPortfolio, rawProject } from '../fixtures/raw-portfolios'
import { SAMPLE_SETS, load } from '../fixtures/sample-sets'

describe.each(SAMPLE_SETS)('exact figures — %s data set', (_name, p) => {
  it('KPIs: 17 / 11 / 2 / 1 / 7 / 1', () => {
    expect(kpis(p)).toEqual({
      tracked: 17,
      active: 11,
      atRiskOrBlocked: 2,
      overdueMilestones: 1,
      pendingDecisions: 7,
      doneWithResiduals: 1,
    })
  })

  it('health breakdown of tracked projects: 8 / 5 / 1 / 1 / 2', () => {
    expect(healthBreakdown(p)).toEqual({
      onTrack: 8,
      watch: 5,
      alert: 1,
      critical: 1,
      notAssessed: 2,
    })
  })

  it('D1: 8 bars, Organisation & processus = 1 pre-project + 3 in progress', () => {
    const bars = categoryBars(p)
    expect(bars).toHaveLength(8)
    expect(bars[7]).toEqual({
      group: { kind: 'category', id: 'organisation' },
      preProject: 1,
      inProgress: 3,
      done: 0,
    })
    expect(bars[0]).toEqual({
      group: { kind: 'category', id: 'poste' },
      preProject: 0,
      inProgress: 2,
      done: 1,
    })
  })
})

describe('atRiskOrBlocked — label, counted levels and population pinned together', () => {
  it('a lone watch project counts as zero; alert, critical and onHold each count as one', () => {
    const p = load(
      rawPortfolio({
        categories: [{ id: 'c1', name: 'C1', color: 'blue' }],
        projects: [
          rawProject({ id: 'P-01', categoryId: 'c1', stage: 'inProgress', health: 'watch' }),
          rawProject({ id: 'P-02', categoryId: 'c1', stage: 'inProgress', health: 'alert' }),
          rawProject({ id: 'P-03', categoryId: 'c1', stage: 'inProgress', health: 'critical' }),
          rawProject({ id: 'P-04', categoryId: 'c1', stage: 'inProgress', onHold: true }),
        ],
      }),
    )
    // The population above holds one project per health level plus one on
    // hold: only alert, critical and onHold are counted — 'watch' alone
    // contributes zero, which is what both catalog labels below claim.
    expect(kpis(p).atRiskOrBlocked).toBe(3)
    expect(CATALOG_FR['kpi.atRiskOrBlocked']).toBe('en alerte ou bloqués')
    expect(CATALOG_EN['kpi.atRiskOrBlocked']).toBe('at risk or on hold')
  })
})

describe('D1 bars and orphans', () => {
  it('bars cover every tracked project: their sum is the tracked KPI', () => {
    const p = load(
      rawPortfolio({
        categories: [{ id: 'c1', name: 'C1', color: 'blue' }],
        projects: [
          rawProject({ id: 'P-01', categoryId: 'c1', stage: 'inProgress' }),
          rawProject({ id: 'P-02', categoryId: 'ghost', stage: 'inProgress' }),
          rawProject({ id: 'P-03', categoryId: '', stage: 'ready' }),
          rawProject({ id: 'P-04', categoryId: 'c1', stage: 'closed' }),
        ],
      }),
    )
    const bars = categoryBars(p)
    expect(bars.map((b) => groupKey(b.group))).toEqual(['category:c1', 'orphans'])
    expect(bars[1]).toEqual({
      group: { kind: 'orphans' },
      preProject: 1,
      inProgress: 1,
      done: 0,
    })
    const sum = bars.reduce((n, b) => n + b.preProject + b.inProgress + b.done, 0)
    expect(sum).toBe(kpis(p).tracked)
  })
})
