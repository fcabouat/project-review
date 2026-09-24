import { describe, expect, it } from 'vitest'
import { verdict, type Command } from '../../src/commands'
import { apply, invert } from '../../src/events'
import { execute, hydrate, redo, undo } from '../../src/runtime/editing'
import { readPortfolioJson } from '../../src/services/parse'
import { decodeEvent } from '../../src/services/stored-events'
import { isoDate } from '../../src/values/date'
import { projectId } from '../../src/values/ids'
import { scopeTagsFromText, validScopeTags } from '../../src/values/scope-tags'
import { testPortfolio } from '../fixtures/hand-built-portfolios'
import { MAX_ENTITIES } from '../../src/model/budget'

const today = isoDate('2026-09-24')!
const yesterday = isoDate('2026-09-23')!
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

describe('project scope vocabulary', () => {
  it('normalizes input separators and prefixes without changing or duplicating canonical tags', () => {
    expect(scopeTagsFromText(' a_06, #b2\n#a_06  ')).toEqual(['#a_06', '#b2'])
    expect(scopeTagsFromText('   , ')).toEqual([])
    expect(scopeTagsFromText('Pas de prose!')).toBeUndefined()
    expect(scopeTagsFromText('#NoeMI #ATE team-06 #Mixed_Case-07')).toEqual([
      '#NoeMI',
      '#ATE',
      '#team-06',
      '#Mixed_Case-07',
    ])
    expect(validScopeTags(['#a', '#0', '#_', `#${'a'.repeat(63)}`])).toBe(true)
    expect(validScopeTags(Array.from({ length: 32 }, (_, i) => `#tag_${i}`))).toBe(true)
    for (const bad of [
      null,
      '#a',
      [1],
      ['#'],
      ['#é'],
      ['#a.b'],
      ['#a b'],
      ['a'],
      ['#a', '#a'],
      new Array(1),
      [`#${'a'.repeat(64)}`],
      Array.from({ length: 33 }, (_, i) => `#tag_${i}`),
    ]) {
      expect(validScopeTags(bad)).toBe(false)
    }
  })

  it('imports canonical tags as optional data and rejects invalid JSON vocabulary', () => {
    const portfolio = testPortfolio()
    const withTags = {
      ...portfolio,
      projects: [{ ...portfolio.projects[0]!, scopeTags: ['#team_06', '#site'] }],
    }
    const parsed = readPortfolioJson(JSON.stringify(withTags))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.portfolio.projects[0]?.scopeTags).toEqual(['#team_06', '#site'])
    expect(readPortfolioJson(JSON.stringify(portfolio)).ok).toBe(true)
    for (const scopeTags of [['#invalid!'], ['#a', '#a'], 'a', [null]]) {
      expect(
        readPortfolioJson(
          JSON.stringify({ ...withTags, projects: [{ ...withTags.projects[0], scopeTags }] }),
        ).ok,
      ).toBe(false)
    }
  })
})

describe('bounded project batch changes', () => {
  it('changes only selected projects in one undo step, retaining order and identities', () => {
    const portfolio = testPortfolio(),
      initial = hydrate(portfolio)
    const ids = [portfolio.projects[0]!.id, portfolio.projects[2]!.id]
    const result = execute(
      initial,
      { type: 'ChangeProjects', ids, change: { field: 'stage', after: 'ready' } },
      today,
    )
    expect(result.event?.type).toBe('ProjectsChanged')
    expect(result.state.log.past).toHaveLength(1)
    expect(result.state.present.projects.map((p) => p.id)).toEqual(
      portfolio.projects.map((p) => p.id),
    )
    expect(
      result.state.present.projects
        .filter((p) => ids.includes(p.id))
        .map((p) => [p.stage, p.updatedOn]),
    ).toEqual([
      ['ready', today],
      ['ready', today],
    ])
    expect(result.state.present.projects[1]).toBe(portfolio.projects[1])
    expect(undo(result.state).present).toEqual(portfolio)
    expect(redo(undo(result.state)).present).toEqual(result.state.present)
    expect(decodeEvent(wire(result.event))).toEqual(result.event)
  })

  it('allows category moves and uncategorization, excludes unchanged selections and treats an all-unchanged batch as a no-op', () => {
    const portfolio = testPortfolio(),
      initial = hydrate(portfolio),
      first = portfolio.projects[0]!
    const command = {
      type: 'ChangeProjects',
      ids: portfolio.projects.map((p) => p.id),
      change: { field: 'categoryId', after: first.categoryId },
    } as const
    const result = execute(initial, command, today)
    expect(result.event?.type).toBe('ProjectsChanged')
    if (result.event?.type === 'ProjectsChanged')
      expect(result.event.before.map((p) => p.id)).not.toContain(first.id)
    expect(result.state.present.projects[0]).toBe(first)
    expect(execute(result.state, command, today).state).toBe(result.state)
    const uncategorized = execute(
      initial,
      { type: 'ChangeProjects', ids: [first.id], change: { field: 'categoryId', after: '' } },
      today,
    )
    expect(uncategorized.state.present.projects[0]?.categoryId).toBe('')
    expect(undo(uncategorized.state).present).toEqual(portfolio)
  })

  it('rejects unknown or duplicate identities and unsupported or invalid batch values atomically', () => {
    const initial = hydrate(testPortfolio()),
      id = initial.present.projects[0]!.id
    const base = { type: 'ChangeProjects', ids: [id], change: { field: 'stage', after: 'ready' } }
    for (const command of [
      { ...base, ids: [] },
      { ...base, ids: [id, id] },
      { ...base, ids: [id, 'missing'] },
      { ...base, ids: new Array(1) },
      { ...base, ids: [''] },
      { ...base, ids: null },
      { ...base, change: null },
      { ...base, change: { field: 'stage', after: 'imaginary' } },
      { ...base, change: { field: 'categoryId', after: 'missing' } },
      { ...base, change: { field: 'id', after: 'replacement' } },
      { ...base, change: { field: 'lead', after: 'not a supported batch action' } },
    ]) {
      expect(execute(initial, command as Command, today).state).toBe(initial)
    }
    expect(
      execute(
        initial,
        { type: 'ChangeProjectField', id, field: 'id', after: 'replacement' } as never,
        today,
      ).state,
    ).toBe(initial)
  })
})

describe('project modification date travels with the content event', () => {
  it('timestamps creation and content edits, including a formerly absent date, and reverses both together', () => {
    const initial = hydrate(testPortfolio()),
      first = initial.present.projects[0]!,
      second = initial.present.projects[1]!
    const created = { ...second, id: projectId('new-project')!, updatedOn: yesterday }
    const creation = execute(initial, { type: 'CreateProject', project: created, index: 0 }, today)
    expect(creation.state.present.projects[0]?.updatedOn).toBe(today)
    expect(undo(creation.state).present).toEqual(initial.present)
    for (const project of [first, second]) {
      const result = execute(
        initial,
        { type: 'ChangeProjectField', id: project.id, field: 'name', after: 'Updated name' },
        today,
      )
      expect(result.event).toMatchObject({ modified: { before: project.updatedOn, after: today } })
      expect(result.state.present.projects.find((p) => p.id === project.id)?.updatedOn).toBe(today)
      expect(result.state.log.past).toHaveLength(1)
      expect(undo(result.state).present).toEqual(initial.present)
      expect(redo(undo(result.state)).present).toEqual(result.state.present)
      const decoded = decodeEvent(wire(result.event))!
      expect(decoded).toBeDefined()
      expect(apply(apply(initial.present, decoded), invert(decoded))).toEqual(initial.present)
    }
  })

  it('timestamps narrative, milestone, decision and tag edits without inventing a separate history step', () => {
    const initial = hydrate(testPortfolio()),
      id = initial.present.projects[0]!.id
    const commands: Command[] = [
      { type: 'ChangeProjectList', id, list: 'ongoing', after: ['Changed work'] },
      {
        type: 'ChangeProjectMilestones',
        id,
        after: [{ label: 'New milestone', date: today, done: false }],
      },
      { type: 'ChangeProjectDecisions', id, after: [{ question: 'New question' }] },
      { type: 'ChangeProjectField', id, field: 'scopeTags', after: ['#team_06'] },
    ]
    for (const command of commands) {
      const result = execute(initial, command, today)
      expect(result.state.present.projects[0]?.updatedOn).toBe(today)
      expect(result.state.log.past).toHaveLength(1)
      expect(decodeEvent(wire(result.event))).toEqual(result.event)
      expect(undo(result.state).present).toEqual(initial.present)
      expect(redo(undo(result.state)).present).toEqual(result.state.present)
    }
  })

  it('preserves date for no-op values and same-day edits; callers can omit the clock but cannot pass an invalid one', () => {
    const initial = hydrate(testPortfolio()),
      project = initial.present.projects[0]!
    const rename = {
      type: 'ChangeProjectField',
      id: project.id,
      field: 'name',
      after: 'Changed name',
    } as const
    expect(execute(initial, { ...rename, after: project.name }, today).state).toBe(initial)
    expect(execute(initial, rename).state.present.projects[0]?.updatedOn).toBe(project.updatedOn)
    expect(execute(initial, rename, project.updatedOn).event).not.toHaveProperty('modified')
    expect(verdict(initial.present, rename, 'not-a-date' as never)).toEqual({
      ok: false,
      refusal: 'offContract',
    })
    for (const command of [
      { type: 'ChangeProjectList', id: project.id, list: 'done', after: [...project.done] },
      { type: 'ChangeProjectMilestones', id: project.id, after: [...project.milestones] },
      { type: 'ChangeProjectDecisions', id: project.id, after: [...project.decisions] },
    ] as Command[]) {
      expect(execute(initial, command, today).state.present.projects[0]?.updatedOn).toBe(
        project.updatedOn,
      )
    }
    const explicitDate = execute(
      initial,
      { type: 'ChangeProjectField', id: project.id, field: 'updatedOn', after: yesterday },
      today,
    )
    expect(explicitDate.state.present.projects[0]?.updatedOn).toBe(yesterday)
    expect(explicitDate.event).not.toHaveProperty('modified')
  })

  it('does not rewrite dates when reordering, importing or changing review settings', () => {
    const initial = hydrate(testPortfolio()),
      project = initial.present.projects[0]!
    const imported = {
      ...initial.present,
      projects: [{ ...project, name: 'Received name', updatedOn: yesterday }],
    }
    for (const command of [
      { type: 'ReplacePortfolio', portfolio: imported },
      { type: 'MergeProjects', projects: imported.projects, categories: [] },
    ] as Command[]) {
      expect(
        execute(initial, command, today).state.present.projects.find((p) => p.id === project.id)
          ?.updatedOn,
      ).toBe(yesterday)
    }
    const moved = execute(initial, { type: 'MoveProject', id: project.id, to: 2 }, today)
    expect(moved.state.present.projects.find((p) => p.id === project.id)).toEqual(project)
    const review = execute(
      initial,
      { type: 'ChangeReviewField', field: 'title', after: 'Another review' },
      today,
    )
    expect(review.state.present.projects).toBe(initial.present.projects)
  })

  it('refuses malformed stored date metadata and batch identity substitutions', () => {
    const initial = hydrate(testPortfolio()),
      project = initial.present.projects[0]!
    const event = execute(
      initial,
      { type: 'ChangeProjectField', id: project.id, field: 'name', after: 'Updated' },
      today,
    ).event!
    for (const modified of [
      null,
      [],
      'today',
      { after: 'bad' },
      { before: 'bad', after: today },
      { after: today, unexpected: true },
      { before: 1 },
    ]) {
      expect(decodeEvent(wire({ ...event, modified }))).toBeUndefined()
    }
    const bulk = {
      type: 'ProjectsChanged',
      before: [project],
      after: [{ ...project, stage: 'ready' }],
    }
    expect(decodeEvent(wire(bulk))).toEqual(bulk)
    for (const bad of [
      { ...bulk, before: [], after: [] },
      { ...bulk, before: null },
      { ...bulk, after: [null] },
      { ...bulk, after: [] },
      { ...bulk, after: [{ ...project, id: 'substituted' }] },
      { ...bulk, before: [project, project], after: [project, project] },
      { ...bulk, after: [{ ...project, scopeTags: ['#invalid!'] }] },
    ])
      expect(decodeEvent(wire(bad))).toBeUndefined()
  })

  it('bounds stored batch arrays before inspecting their project payloads', () => {
    const project = testPortfolio().projects[0]!
    const projects = Array.from({ length: MAX_ENTITIES }, (_, i) => ({
      ...project,
      id: projectId(`batch-${i}`)!,
    }))
    const event = { type: 'ProjectsChanged', before: projects, after: projects }
    expect(decodeEvent(event)).toEqual(event)
    const oversized = [...projects, { ...project, id: projectId('overflow')! }]
    expect(decodeEvent({ ...event, before: oversized, after: oversized })).toBeUndefined()
    expect(decodeEvent({ ...event, before: new Array(1), after: new Array(1) })).toBeUndefined()
  })
})
