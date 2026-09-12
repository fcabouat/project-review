import { describe, expect, it } from 'vitest'
import { emptyHistory, HISTORY_LIMIT, hydrate as hydrateHistory } from '../../src/events/history'
import {
  createPersistenceSession,
  type PersistenceDocument,
  type SavePhase,
} from '../../src/services/persistence-session'
import { readStored, STATE_KEY, STATE_FORMAT, writeState } from '../../src/services/persistence'
import { testPortfolio } from '../fixtures/hand-built-portfolios'
import { createManualScheduler, createMemoryStorage } from '../fixtures/persistence-doubles'

describe('persistence session notifications without a framework', () => {
  it('saves the first real edit even when the host sends no mounting echo', () => {
    const storage = createMemoryStorage()
    writeState(storage, null, testPortfolio(), emptyHistory)
    const found = readStored(storage)
    if (found.state !== 'restored') throw new Error('expected restored fixture')
    let present = found.portfolio
    const clock = createManualScheduler()
    const session = createPersistenceSession(
      {
        get present() {
          return present
        },
        past: found.history.past,
        future: found.history.future,
        replace: (portfolio) => {
          present = portfolio
        },
      },
      storage,
      true,
      clock.schedule,
      found,
      { pending: false, commitAll: () => {} },
      () => {},
    )
    present = { ...present, review: { ...present.review, title: 'First real edit' } }
    session.scheduleSave(present, found.history)
    expect(session.control.save?.phase).toBe('dirty')
    clock.fire()
    const saved = readStored(storage)
    expect(saved.state === 'restored' && saved.portfolio.review.title).toBe('First real edit')
    expect(session.control.save?.phase).toBe('saved')
  })

  it('does not rewrite a restored log merely because hydration re-capped its array', () => {
    const storage = createMemoryStorage()
    storage.setItem(
      STATE_KEY,
      JSON.stringify({
        format: STATE_FORMAT,
        revision: 1,
        portfolio: testPortfolio(),
        history: {
          past: Array.from({ length: HISTORY_LIMIT + 1 }, (_, index) => ({
            type: 'ReviewFieldChanged',
            field: 'title',
            before: `t${index}`,
            after: `t${index + 1}`,
          })),
          future: [],
        },
      }),
    )
    const found = readStored(storage)
    if (found.state !== 'restored') throw new Error('expected restored fixture')
    const history = hydrateHistory(found.history)
    expect(history.past).not.toBe(found.history.past)
    const clock = createManualScheduler()
    const session = createPersistenceSession(
      { present: found.portfolio, ...history, replace: () => {} },
      storage,
      true,
      clock.schedule,
      found,
      { pending: false, commitAll: () => {} },
      () => {},
    )
    const writes = storage.writes
    session.scheduleSave(found.portfolio, history)
    session.flush()
    clock.fire()
    expect(storage.writes).toBe(writes)
    expect(session.control.save?.phase).toBe('saved')
  })

  it('notifies after direct and scheduled transitions, reading committed input on flush', () => {
    let present = testPortfolio()
    const document: PersistenceDocument = {
      get present() {
        return present
      },
      past: emptyHistory.past,
      future: emptyHistory.future,
      replace: (portfolio) => {
        present = portfolio
      },
    }
    const storage = createMemoryStorage()
    const clock = createManualScheduler()
    let pending = false
    const phases: (SavePhase | undefined)[] = []
    const session = createPersistenceSession(
      document,
      storage,
      false,
      clock.schedule,
      { state: 'absent' },
      {
        get pending() {
          return pending
        },
        commitAll: () => {
          present = { ...present, review: { ...present.review, title: 'Closing draft' } }
          pending = false
        },
      },
      () => phases.push(session.control.save?.phase),
    )
    session.control.toggle(true)
    expect(phases).toEqual(['saved'])
    present = { ...present, review: { ...present.review, title: 'Debounced edit' } }
    session.scheduleSave(present, emptyHistory)
    expect(phases).toEqual(['saved', 'dirty'])
    clock.fire()
    expect(phases).toEqual(['saved', 'dirty', 'saved'])
    pending = true
    expect(session.control.save?.phase).toBe('pending')
    session.flush()
    const found = readStored(storage)
    expect(found.state === 'restored' && found.portfolio.review.title).toBe('Closing draft')
    expect(phases).toEqual(['saved', 'dirty', 'saved', 'saved'])
  })
})
