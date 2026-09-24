/**
 * Pins the editing use case (`src/runtime/editing.ts`) — the front loop
 * composed from its pieces: `decide` completes the command, `apply` runs the
 * event, the register records it. Everything the app's runtime binding
 * promises (undoable edits, bounded history, silent refusals, session
 * hydration) is proven HERE, on the pure state; `app/tests/bindings/`
 * only covers the runes.
 */

import { describe, expect, it } from 'vitest'
import type { Portfolio } from '../../src/model/portfolio'
import { apply, type DomainEvent } from '../../src/events'
import { HISTORY_LIMIT } from '../../src/events/history'
import type { Command } from '../../src/commands'
import { progressOf } from '../../src/values/progress'
import { execute, hydrate, redo, undo, type RuntimeState } from '../../src/runtime/editing'
import { otherPortfolio, projectOf, testPortfolio } from '../fixtures/hand-built-portfolios'

/** Five families of commands in rotation, each a real change against any state. */
const commandN = (n: number): Command => {
  switch (n % 5) {
    case 0:
      return {
        type: 'ChangeProjectField',
        id: 'P-01',
        field: 'progress',
        after: progressOf(n % 101)!,
      }
    case 1:
      return { type: 'RenameCategory', id: 'infra', after: `Infrastructure ${n}` }
    case 2:
      return {
        type: 'ChangeProjectList',
        id: 'P-02',
        list: 'done',
        after: [`puce ${n}`],
      }
    case 3:
      return { type: 'ChangeReviewField', field: 'title', after: `Revue ${n}` }
    default:
      return { type: 'ChangeSetting', setting: 'recapRows', after: 6 + (n % 11) }
  }
}

/** Sugar for the tests: execute and keep only the state. */
const run = (state: RuntimeState, command: Command): RuntimeState => execute(state, command).state

describe('hydrate — initial state', () => {
  it('starts on the given portfolio, empty log', () => {
    const s = hydrate(testPortfolio())
    expect(s.present).toStrictEqual(testPortfolio())
    expect(s.log.past).toEqual([])
    expect(s.log.future).toEqual([])
  })
})

describe('execute(command)', () => {
  it('decides, applies, records the COMPLETED event and exposes it at the seam', () => {
    const s0 = hydrate(testPortfolio())
    const before = projectOf(s0.present, 'P-01').progress
    const { state, event } = execute(s0, commandN(0))
    expect(projectOf(state.present, 'P-01').progress).toBe(0)
    // The recorded event carries the true `before`, recovered by `decide`.
    expect(event).toEqual({
      type: 'ProjectFieldChanged',
      id: 'P-01',
      field: 'progress',
      before,
      after: 0,
    })
    expect(state.log.past).toEqual([event])
    expect(state.log.future).toEqual([])
  })

  it('an execute after an undo clears the future (new branch)', () => {
    let s = hydrate(testPortfolio())
    s = run(s, commandN(0))
    s = run(s, commandN(1))
    s = undo(undo(s))
    expect(s.log.future).toHaveLength(2)

    s = run(s, commandN(3))
    expect(s.log.future).toHaveLength(0)
    expect(s.log.past).toHaveLength(1)
    expect(s.present.review.title).toBe('Revue 3')
  })

  it('an INAPPLICABLE command is a silent no-op: nothing enters the log', () => {
    const s0 = hydrate(testPortfolio())
    const { state, event } = execute(s0, {
      type: 'ChangeProjectField',
      id: 'ABSENT',
      field: 'name',
      after: 'y',
    })
    expect(event).toBeUndefined()
    expect(state).toBe(s0) // the input state, returned as-is
    expect(state.present).toStrictEqual(testPortfolio())
  })

  it('a TRIVIAL command (same scalar value) records nothing either', () => {
    const s0 = hydrate(testPortfolio())
    const { state, event } = execute(s0, {
      type: 'ChangeReviewField',
      field: 'title',
      after: s0.present.review.title,
    })
    expect(event).toBeUndefined()
    expect(state.log.past).toEqual([])
  })
})

describe('undo / redo across the whole (bounded) history', () => {
  it('50 executes, 50 undos back to the initial state, 50 redos back to the final one', () => {
    const initial = testPortfolio()
    let s = hydrate(initial)
    for (let n = 0; n < 50; n += 1) s = run(s, commandN(n))
    const final = s.present

    expect(s.log.past).toHaveLength(50)
    expect(s.log.future).toHaveLength(0)
    expect(s.present).not.toStrictEqual(initial)

    for (let n = 0; n < 50; n += 1) s = undo(s)

    expect(s.present).toStrictEqual(initial)
    expect(s.log.future).toHaveLength(50)
    expect(s.log.past).toHaveLength(0)

    for (let n = 0; n < 50; n += 1) s = redo(s)

    expect(s.present).toStrictEqual(final)
    expect(s.log.past).toHaveLength(50)
    expect(s.log.future).toHaveLength(0)
  })

  it('undo and redo are the identity on empty stacks', () => {
    const s = hydrate(testPortfolio())
    expect(undo(s)).toBe(s)
    expect(redo(s)).toBe(s)
  })

  it('does not mutate the initial portfolio', () => {
    const initial = testPortfolio()
    const fingerprint = JSON.stringify(initial)
    let s = hydrate(initial)
    for (let n = 0; n < 50; n += 1) s = run(s, commandN(n))
    expect(JSON.stringify(initial)).toBe(fingerprint)
  })
})

describe(`bounded history — ${HISTORY_LIMIT} events in the log`, () => {
  it('drops the OLDEST event at the record that would exceed the cap', () => {
    let s = hydrate(testPortfolio())
    s = run(s, { type: 'ChangeReviewField', field: 'title', after: 'sentinel' })
    const first = s.log.past[0]
    expect(first).toBeDefined()
    // Fill up to the cap exactly (recapRows flips value on every command).
    for (let n = 1; n < HISTORY_LIMIT; n += 1) {
      s = run(s, { type: 'ChangeSetting', setting: 'recapRows', after: 6 + (n % 2) })
    }
    expect(s.log.past).toHaveLength(HISTORY_LIMIT)
    expect(s.log.past[0]).toBe(first)

    // The 501st record: the sentinel falls off, the cap holds.
    s = run(s, { type: 'ChangeReviewField', field: 'title', after: 'past the cap' })
    expect(s.log.past).toHaveLength(HISTORY_LIMIT)
    expect(s.log.past[0]).not.toBe(first)
    expect(s.log.past.at(-1)?.type).toBe('ReviewFieldChanged')
  })

  it('undo bottoms out at the cap: what was dropped cannot be undone', () => {
    let s = hydrate(testPortfolio())
    for (let n = 0; n <= HISTORY_LIMIT; n += 1) {
      s = run(s, { type: 'ChangeSetting', setting: 'recapRows', after: 6 + (n % 11) })
    }
    let undos = 0
    while (s.log.past.length > 0) {
      s = undo(s)
      undos += 1
    }
    expect(undos).toBe(HISTORY_LIMIT)
    // The dropped first edit stays applied for good.
    expect(s.present).not.toStrictEqual(testPortfolio())
  })
})

describe('global replacement (import) through the loop', () => {
  it('switches to the new portfolio through a single event', () => {
    const s0 = hydrate(testPortfolio())
    const { state, event } = execute(s0, {
      type: 'ReplacePortfolio',
      portfolio: otherPortfolio(),
    })

    expect(state.present).toStrictEqual(otherPortfolio())
    expect(state.log.past).toHaveLength(1)
    expect(event?.type).toBe('PortfolioReplaced')
    // `decide` filled `before` with the replaced present.
    expect((event as DomainEvent & { before: Portfolio }).before).toStrictEqual(testPortfolio())
  })

  it('is undoable like any other edit (reversible import)', () => {
    let s = hydrate(testPortfolio())
    s = run(s, commandN(0))
    const beforeImport = s.present

    s = run(s, { type: 'ReplacePortfolio', portfolio: otherPortfolio() })
    s = undo(s)
    expect(s.present).toStrictEqual(beforeImport)

    s = redo(s)
    expect(s.present).toStrictEqual(otherPortfolio())
  })

  it('chains two replacements and undoes them one by one', () => {
    const initial = testPortfolio()
    let s = hydrate(initial)
    s = run(s, { type: 'ReplacePortfolio', portfolio: otherPortfolio() })
    s = run(s, { type: 'ReplacePortfolio', portfolio: testPortfolio() })

    expect(s.present).toStrictEqual(initial)
    s = undo(s)
    expect(s.present).toStrictEqual(otherPortfolio())
    s = undo(s)
    expect(s.present).toStrictEqual(initial)
  })
})

describe('hydrate — restored session', () => {
  it('a hydrated past is undoable from the very first call', () => {
    const initial = testPortfolio()
    const e: DomainEvent = {
      type: 'ReviewFieldChanged',
      field: 'title',
      before: initial.review.title,
      after: 'Revue 0',
    }
    let s = hydrate(apply(initial, e), { past: [e], future: [] })

    expect(s.log.past).toHaveLength(1)
    s = undo(s)
    expect(s.present).toStrictEqual(initial)
    expect(s.log.past).toEqual([])
  })

  it('a hydrated future is redoable from the very first call', () => {
    const initial = testPortfolio()
    const e: DomainEvent = {
      type: 'ReviewFieldChanged',
      field: 'title',
      before: initial.review.title,
      after: 'Revue 3',
    }
    let s = hydrate(initial, { past: [], future: [e] })

    expect(s.log.future).toHaveLength(1)
    s = redo(s)
    expect(s.present).toStrictEqual(apply(initial, e))
    expect(s.log.past).toEqual([e])
  })
})
