import { expect, it } from 'vitest'
import { testPortfolio } from '../../../packages/core/tests/fixtures/hand-built-portfolios'
import { isoDate } from '@project-review/core/values/date'
import { remapCollectionDrafts } from '../../src/bindings/collection-drafts'

const id = testPortfolio().projects[0]!.id
const key = (...parts: unknown[]) => JSON.stringify(['project', id, ...parts])
const first = { label: 'First', date: isoDate('2026-01-01')!, done: false }
const second = { ...first, label: 'Second' }
const unrelated = { key: key('start'), base: '', value: '2026-' }

it('preserves unrelated fields, follows surviving rows and drops only removed-row drafts', () => {
  const raw = { key: key('milestone', 1, 'date'), base: second.date, value: '2026-0' }
  const removed = { ...raw, key: key('milestone', 0, 'date') }
  const event = {
    type: 'ProjectMilestonesChanged' as const,
    id,
    before: [first, second],
    after: [second],
  }
  expect(remapCollectionDrafts([unrelated, raw, removed], event)).toEqual([
    unrelated,
    { ...raw, key: key('milestone', 0, 'date') },
  ])
  // Reloaded history does not preserve object identities.
  expect(remapCollectionDrafts([raw], { ...event, after: [{ ...second }] })).toEqual([
    { ...raw, key: key('milestone', 0, 'date') },
  ])
  expect(
    remapCollectionDrafts([removed], { ...event, before: [first], after: [first, second] }),
  ).toEqual([removed])
  expect(
    remapCollectionDrafts([removed], { ...event, after: [{ ...first, label: 'Changed' }] }),
  ).toEqual([])
  expect(
    remapCollectionDrafts([raw], { ...event, before: [first, { ...first }], after: [first] }),
  ).toEqual([])
})

it('rebases incomplete outcome arrays and individual fields when decisions are added or removed', () => {
  const decision = { question: 'Choose?' }
  const added = { question: 'Next?' }
  const outcome = { text: 'Unfinished answer', when: '' }
  const aggregate = {
    key: key('outcomes'),
    base: JSON.stringify([decision]),
    value: JSON.stringify([outcome]),
  }
  const event = {
    type: 'ProjectDecisionsChanged' as const,
    id,
    before: [decision],
    after: [decision, added],
  }
  const updated = remapCollectionDrafts([unrelated, aggregate], event)
  expect(updated).toEqual([
    unrelated,
    {
      ...aggregate,
      base: JSON.stringify(event.after),
      value: JSON.stringify([outcome, { text: '', when: '' }]),
    },
  ])
  expect(
    remapCollectionDrafts(updated, { ...event, before: event.after, after: [decision] }),
  ).toEqual([unrelated, aggregate])
  const cell = { key: key('decision', 1, 'text'), base: '', value: 'pending' }
  expect(
    remapCollectionDrafts([cell], { ...event, before: [added, decision], after: [decision] }),
  ).toEqual([{ ...cell, key: key('decision', 0, 'text') }])
  for (const invalid of [
    { ...aggregate, base: 'stale' },
    { ...aggregate, value: '{' },
    { ...aggregate, value: '{}' },
    { ...aggregate, value: '[]' },
    { ...aggregate, key: key('decision', -1, 'text') },
    { ...aggregate, key: '["project",' + JSON.stringify(id) + ',"decision",invalid' },
  ])
    expect(remapCollectionDrafts([invalid], event)).toEqual([])
})
