/**
 * Pins the soft validation (`src/editor/validation.ts`) — improbable but
 * PERMITTED field combinations: they earn a badge, never a refusal (the
 * strict parse owns refusals). Each rule is probed one combination at a time
 * on the minimal project of `../fixtures/minimal-elements.ts`.
 */
import { describe, expect, it } from 'vitest'
import type { Project } from '@project-review/core/model/project'
import { isoDate } from '@project-review/core/values/date'
import { progressOf } from '@project-review/core/values/progress'
import { testPortfolio } from '../../../core/tests/fixtures/hand-built-portfolios'
import { category, project } from '../fixtures/minimal-elements'
import { portfolioWarnings, projectWarnings } from '../../src/editor/validation'

const keys = (p: Project): readonly string[] => projectWarnings(p).map((w) => w.key)

describe('projectWarnings — the five project-level rules, one by one', () => {
  it('a plausible project earns no badge', () => {
    expect(projectWarnings(project({}))).toEqual([])
  })

  it('progress 100 % outside "residuals" / "closed"', () => {
    expect(keys(project({ progress: progressOf(100)! }))).toEqual(['editor.check.progress100'])
    expect(keys(project({ progress: progressOf(100)!, stage: 'residuals' }))).toEqual([])
    expect(keys(project({ progress: progressOf(100)!, stage: 'closed' }))).toEqual([])
    expect(keys(project({ progress: progressOf(99)! }))).toEqual([])
  })

  it('health set on an archived project', () => {
    expect(keys(project({ stage: 'closed', health: 'onTrack' }))).toEqual([
      'editor.check.healthOnArchived',
    ])
    expect(keys(project({ stage: 'inProgress', health: 'onTrack' }))).toEqual([])
  })

  it('"on hold" on a project still to scope', () => {
    expect(keys(project({ stage: 'toScope', onHold: true }))).toEqual([
      'editor.check.onHoldOnScoping',
    ])
    expect(keys(project({ stage: 'ready', onHold: true }))).toEqual([])
  })

  it('pending decision on an archived project — a taken one is fine', () => {
    expect(keys(project({ stage: 'abandoned', decisions: [{ question: 'Q ?' }] }))).toEqual([
      'editor.check.decisionOnArchived',
    ])
    expect(
      keys(
        project({
          stage: 'abandoned',
          decisions: [{ question: 'Q ?', taken: { text: 'ok', when: isoDate('2026-01-01')! } }],
        }),
      ),
    ).toEqual([])
  })

  it('actual end without a settled stage', () => {
    expect(keys(project({ actualEnd: isoDate('2026-06-01')! }))).toEqual([
      'editor.check.actualEndWithoutStage',
    ])
    expect(keys(project({ actualEnd: isoDate('2026-06-01')!, stage: 'residuals' }))).toEqual([])
  })

  it('cumulates in a stable order — and "abandonné" is archived, not settled', () => {
    const p = project({
      stage: 'abandoned',
      progress: progressOf(100)!,
      health: 'critical',
      decisions: [{ question: 'Q ?' }],
      actualEnd: isoDate('2026-06-01')!,
    })
    expect(keys(p)).toEqual([
      'editor.check.progress100',
      'editor.check.healthOnArchived',
      'editor.check.decisionOnArchived',
      'editor.check.actualEndWithoutStage',
    ])
  })
})

describe('portfolioWarnings — duplicate colors', () => {
  it('warns once per shared color, not once per extra category', () => {
    const p = {
      ...testPortfolio(),
      categories: [
        category('a', 'blue'),
        category('b', 'blue'),
        category('c', 'blue'),
        category('d', 'red'),
      ],
    }
    const warnings = portfolioWarnings(p)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toEqual({
      key: 'editor.check.duplicateColor',
      slots: { color: 'blue' },
    })
  })

  it('warns once per color when several colors are shared', () => {
    const p = {
      ...testPortfolio(),
      categories: [
        category('a', 'blue'),
        category('b', 'blue'),
        category('c', 'red'),
        category('d', 'red'),
        category('e', 'red'),
      ],
    }
    expect(portfolioWarnings(p).map((w) => w.slots?.['color'])).toEqual(['blue', 'red'])
  })

  it('stays silent when every category has its own color', () => {
    const p = {
      ...testPortfolio(),
      categories: [category('a', 'blue'), category('b', 'red')],
    }
    expect(portfolioWarnings(p)).toEqual([])
  })
})
