/**
 * Pins the runtime binding (`src/bindings/runtime.svelte.ts`) — the RUNES
 * only: the state is exposed, the calls are delegated, the getters recompute
 * after every rebind. The orchestration itself (decide → apply → record,
 * bounded register, hydration) is the core's and is proven in
 * `packages/core/tests/runtime/editing.test.ts`.
 */

import { describe, expect, it } from 'vitest'
import type { Portfolio } from '@project-review/core/model/portfolio'
import { apply, type DomainEvent } from '@project-review/core/events'
import {
  otherPortfolio,
  testPortfolio,
} from '../../../packages/core/tests/fixtures/hand-built-portfolios'
import { createStore } from '../../src/bindings/runtime.svelte'

const titleEvent = (p: Portfolio, after: string): DomainEvent => ({
  type: 'ReviewFieldChanged',
  field: 'title',
  before: p.review.title,
  after,
})

describe('createStore — binding', () => {
  it('starts on the given portfolio, empty stacks', () => {
    const s = createStore(testPortfolio())
    expect(s.present).toStrictEqual(testPortfolio())
    expect(s.past).toEqual([])
    expect(s.future).toEqual([])
    expect(s.canUndo).toBe(false)
    expect(s.canRedo).toBe(false)
  })

  it('dispatch delegates to the editing service, rebinds and returns the event', () => {
    const s = createStore(testPortfolio())
    const event = s.dispatch({ type: 'ChangeReviewField', field: 'title', after: 'Revue 1' })
    expect(event?.type).toBe('ReviewFieldChanged')
    expect(s.present.review.title).toBe('Revue 1')
    expect(s.past).toEqual([event])
    // A refused command returns undefined and rebinds nothing.
    expect(
      s.dispatch({ type: 'ChangeProjectField', id: 'ABSENT', field: 'name', after: 'y' }),
    ).toBeUndefined()
    expect(s.past).toHaveLength(1)
  })

  it('undo/redo delegate and the predicates recompute — they are not frozen', () => {
    const s = createStore(testPortfolio())
    expect(s.canUndo).toBe(false)
    s.dispatch({ type: 'ChangeReviewField', field: 'title', after: 'Revue 1' })
    expect(s.canUndo).toBe(true)
    expect(s.canRedo).toBe(false)
    s.undo()
    expect(s.present).toStrictEqual(testPortfolio())
    expect(s.canUndo).toBe(false)
    expect(s.canRedo).toBe(true)
    s.redo()
    expect(s.present.review.title).toBe('Revue 1')
    expect(s.canRedo).toBe(false)
  })

  it('a global replacement is just a dispatch: one undoable PortfolioReplaced', () => {
    // No sugar member for this: the import dialog dispatches ReplacePortfolio
    // itself — the binding exposes exactly one write channel.
    const s = createStore(testPortfolio())
    const event = s.dispatch({ type: 'ReplacePortfolio', portfolio: otherPortfolio() })
    expect(event?.type).toBe('PortfolioReplaced')
    expect(s.present).toStrictEqual(otherPortfolio())
    expect(s.past).toHaveLength(1)
    s.undo()
    expect(s.present).toStrictEqual(testPortfolio())
  })

  it('a hydrated session is undoable/redoable from the very first call', () => {
    const initial = testPortfolio()
    const e = titleEvent(initial, 'Revue 0')
    const s = createStore(apply(initial, e), { past: [e], future: [] })
    expect(s.canUndo).toBe(true)
    s.undo()
    expect(s.present).toStrictEqual(initial)
  })

  it('law 3 — exposes only present, the trail and the operations', () => {
    // If this key census grows, something derived is being stored: law 3
    // ("nothing derived is stored") is broken at the binding, whatever the
    // core still guarantees.
    const s = createStore(testPortfolio())
    expect(Object.keys(s).sort()).toEqual(
      ['canRedo', 'canUndo', 'dispatch', 'future', 'past', 'present', 'redo', 'undo'].sort(),
    )
  })
})
