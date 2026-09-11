/**
 * Pins the persistence wiring (`src/bindings/persistence-control.svelte.ts`)
 * — the local-save switch, the debounced save of the whole envelope, the save
 * state the shell shows, and the guarded write that keeps two tabs honest.
 * In-memory storage (`../fixtures/failing-storage.ts`) and fake timers: the
 * debounce rides the real `SAVE_DELAY_MS` through the infrastructure's
 * `timeoutScheduler`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Portfolio } from '@project-review/core/model/portfolio'
import { emptyHistory } from '@project-review/core/events/history'
import { testPortfolio } from '../../../packages/core/tests/fixtures/hand-built-portfolios'
import { createStore, type Store } from '../../src/bindings/runtime.svelte'
import {
  createPersistenceControl,
  type PersistenceWiring,
} from '../../src/bindings/persistence-control.svelte'
import {
  PREF_KEY,
  SAVE_DELAY_MS,
  STATE_KEY,
  clearStored,
  loadPersistEnabled,
  readStored,
  storedStamp,
  writeState,
  type KeyValueStorage,
  type StateStamp,
  type StoredState,
  type WriteOutcome,
} from '@project-review/core/services/persistence'
import { timeoutScheduler } from '@project-review/infrastructure/scheduler'
import {
  createHostileStorage,
  createMemoryStorage,
  observeWrites,
} from '../fixtures/failing-storage'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

/** The stored portfolio, or `null` when nothing readable is there. */
const stored = (storage: KeyValueStorage): unknown => {
  const back = readStored(storage)
  return back.state === 'restored' ? back.portfolio : null
}

/** The stored log, or `null` when nothing readable is there. */
const storedLog = (storage: KeyValueStorage): unknown => {
  const back = readStored(storage)
  return back.state === 'restored' ? back.history : null
}

/** The open document, told apart from the stored one by its title. */
const otherPortfolio = (): Portfolio => ({
  ...testPortfolio(),
  review: { ...testPortfolio().review, title: 'The stored one' },
})

/** The title the storage currently holds — how an edit is told from an echo. */
const storedTitle = (storage: KeyValueStorage): string | undefined => {
  const back = readStored(storage)
  return back.state === 'restored' ? back.portfolio.review.title : undefined
}

/** The monotone number the stored envelope announces — read from the bytes,
 * since a stamp is opaque to everything but an equality test. */
const revisionInStorage = (storage: KeyValueStorage): unknown =>
  JSON.parse(storage.getItem(STATE_KEY)!).revision

/** The stamp a successful write handed back, asserting that it WAS one. */
const writtenStamp = (outcome: WriteOutcome): StateStamp => {
  expect(outcome.outcome).toBe('written')
  return outcome.outcome === 'written' ? outcome.stamp : ''
}

/**
 * The wiring as the APP builds it (App.svelte): the store hydrated from the
 * very document the storage handed over. That is what makes the mounting
 * effect's first call an echo rather than an edit — the anti-echo compares
 * documents, and the document it was handed is the one it reads back.
 */
const bootedOn = (storage: KeyValueStorage, found: StoredState, enabled = true) => {
  const store = createStore(
    found.state === 'restored' ? found.portfolio : testPortfolio(),
    found.state === 'restored' ? found.history : undefined,
  )
  return {
    store,
    wiring: createPersistenceControl(store, storage, enabled, timeoutScheduler, found),
  }
}

/** What the mounting effect hands over: the document and its two stacks. */
const effect = (wiring: PersistenceWiring, store: Store): void =>
  wiring.scheduleSave(store.present, { past: store.past, future: store.future })

/** ONE real edit — the runtime rebuilds `present` on every step it records
 * (`execute`), so what the effect carries afterwards is a NEW document. */
const editTitle = (store: Store, title: string): void => {
  store.dispatch({ type: 'ChangeReviewField', field: 'title', after: title })
}

describe('createPersistenceControl', () => {
  it('toggle(on) on an empty storage writes the whole envelope right away', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, false, timeoutScheduler)

    expect(wiring.control.enabled).toBe(false)
    wiring.control.toggle(true)

    expect(wiring.control.enabled).toBe(true)
    expect(storage.getItem(PREF_KEY)).toBe('on')
    expect(stored(storage)).toEqual(testPortfolio())
    expect(storedLog(storage)).toEqual(emptyHistory)
    // ONE key, ONE write: the document and its log cannot come apart.
    expect([...storage.content.keys()].filter((k) => k !== PREF_KEY)).toStrictEqual([STATE_KEY])
  })

  it('toggle(off) erases the stored data, keeps the preference, disarms pending saves', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    wiring.control.toggle(true)
    wiring.scheduleSave(store.present, emptyHistory) // armed…
    wiring.control.toggle(false) // …and must die with the toggle
    vi.advanceTimersByTime(SAVE_DELAY_MS)

    expect(storage.getItem(PREF_KEY)).toBe('off')
    expect(storage.getItem(STATE_KEY)).toBeNull()
    // Nothing is being saved any more, so there is no save state to show.
    expect(wiring.control.save).toBeUndefined()
  })

  it('debounces the scheduled saves to one write, at the shared deadline', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    wiring.scheduleSave(store.present, emptyHistory)
    wiring.scheduleSave(store.present, emptyHistory)
    wiring.scheduleSave(store.present, emptyHistory)
    expect(storage.content.size).toBe(0)
    expect(wiring.control.save).toStrictEqual({ revision: 3, phase: 'dirty' })

    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(storage.writes).toBe(1)
    expect(stored(storage)).toEqual(testPortfolio())
    expect(wiring.control.save).toStrictEqual({ revision: 3, phase: 'saved' })
  })

  it('flush fires what is pending NOW (the pagehide path)', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    wiring.scheduleSave(store.present, emptyHistory)
    wiring.flush()
    expect(stored(storage)).toEqual(testPortfolio())
  })

  it('schedules nothing while disabled', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, false, timeoutScheduler)

    wiring.scheduleSave(store.present, emptyHistory)
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(storage.content.size).toBe(0)
  })

  it('boots on the log that travelled in the same bytes as the portfolio', () => {
    // The reason the envelope exists: a log restored from anywhere else could
    // invert events of a document that is not the one on screen.
    const storage = createMemoryStorage()
    const log = {
      past: [{ type: 'ReviewFieldChanged', field: 'title', before: 'a', after: 'b' }],
      future: [],
    } as const
    writeState(storage, null, otherPortfolio(), log)

    const found = readStored(storage)
    if (found.state !== 'restored') throw new Error('expected a restored state')
    const store = createStore(found.portfolio, found.history)
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler, found)

    expect(store.present).toEqual(otherPortfolio())
    expect(store.past).toEqual(log.past)
    // Nothing to do: the document on screen IS the stored one.
    expect(wiring.control.save).toStrictEqual({ revision: 0, phase: 'saved' })
  })

  it('writes nothing back for the mounting effect’s echo of a restored document', () => {
    // Opening a SECOND tab must not put the first one in conflict over a
    // document the two agree on: the boot echo stores nothing and bumps no
    // revision. The next change is an ordinary save.
    const storage = createMemoryStorage()
    writeState(storage, null, testPortfolio(), emptyHistory)
    const found = readStored(storage)
    const { store, wiring } = bootedOn(storage, found)
    storage.writes = 0

    effect(wiring, store) // the mounting effect
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(storage.writes).toBe(0)
    expect(revisionInStorage(storage)).toBe(1)
    expect(wiring.control.save).toStrictEqual({ revision: 0, phase: 'saved' })

    editTitle(store, 'Une vraie modification') // a real change
    effect(wiring, store)
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(revisionInStorage(storage)).toBe(2)
    expect(storedTitle(storage)).toBe('Une vraie modification')
    expect(wiring.control.save).toStrictEqual({ revision: 1, phase: 'saved' })
  })

  it('tolerates the no-storage environment: everything is a safe no-op', () => {
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, null, false, timeoutScheduler)

    expect(() => {
      wiring.control.toggle(true)
      wiring.scheduleSave(store.present, emptyHistory)
      wiring.flush()
      wiring.noticeStoredChange()
      wiring.control.restore()
      wiring.control.keepOpen()
      wiring.control.takeStored()
      wiring.control.keepMine()
      vi.advanceTimersByTime(SAVE_DELAY_MS)
    }).not.toThrow()
    // Nothing CAN be saved here, ever — and that is said, not left to be
    // discovered at the next reload. `undefined` would render no strip at all.
    expect(wiring.control.available).toBe(false)
    expect(wiring.control.save).toStrictEqual({ revision: 0, phase: 'unavailable' })
  })

  it('a storage whose every call throws is the same case, and the boot survives it', () => {
    // The browser that blocks third-party storage throws on the ACCESS, reads
    // included. Every entry point of the wiring must be total over it.
    const storage = createHostileStorage()
    const store = createStore(testPortfolio())

    expect(() => readStored(storage)).not.toThrow()
    expect(readStored(storage)).toStrictEqual({ state: 'unavailable' })
    expect(() => storedStamp(storage)).not.toThrow()
    // Not knowing what is in there is exactly the state in which nothing may
    // be written over it.
    expect(storedStamp(storage)).toBe('unreadable')
    expect(loadPersistEnabled(storage)).toBe(true)
    // `refused`, not `conflict`: no second tab is involved — the storage
    // simply does not answer, and the wiring must not blame one that does not
    // exist.
    expect(writeState(storage, null, testPortfolio(), emptyHistory)).toStrictEqual({
      outcome: 'refused',
    })
    expect(() => clearStored(storage)).not.toThrow()

    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler, {
      state: 'unavailable',
    })
    expect(() => {
      wiring.control.toggle(true)
      wiring.flush()
      wiring.noticeStoredChange()
      wiring.control.takeStored()
      wiring.control.keepMine()
      wiring.scheduleSave(store.present, emptyHistory)
      vi.advanceTimersByTime(SAVE_DELAY_MS)
    }).not.toThrow()
    // The storage object EXISTS — the host handed one over — so the switch is
    // live; what it cannot do is write, and the save state says exactly that:
    // the document lives in this tab, and the strip offers the copy.
    expect(wiring.control.available).toBe(true)
    expect(wiring.control.save?.phase).toBe('error')
  })
})

/**
 * THE FAILURE THAT MUST NEVER BE SWALLOWED. A browser storage does not fail as
 * a whole — a quota is reached by one value, a policy blocks one key. So the
 * storage below says NO to the document and YES to everything around it, and
 * the wiring must still hold that the document is not saved.
 */
describe('a storage that refuses the document key and accepts the others', () => {
  /** Refuses `project-review/state`, accepts the preference and anything else. */
  const pickyStorage = () => {
    const storage = createMemoryStorage()
    storage.refuse = (key) => key === STATE_KEY
    return storage
  }

  it('reports the failure, and no other key’s success acknowledges the document', () => {
    const storage = pickyStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, false, timeoutScheduler)

    // The switch writes the PREFERENCE (accepted) and the document (refused).
    wiring.control.toggle(true)
    expect(storage.getItem(PREF_KEY)).toBe('on') // the other key went through…
    expect(storage.getItem(STATE_KEY)).toBeNull() // …the document did not
    expect(wiring.control.save?.phase).toBe('error')

    // Every later accepted write of some other key must leave the verdict
    // exactly where it is: only the document's own write can acquit it.
    for (let i = 0; i < 3; i += 1) {
      storage.setItem('project-review/scheme', 'dark')
      wiring.scheduleSave(store.present, emptyHistory)
      vi.advanceTimersByTime(SAVE_DELAY_MS)
      expect(wiring.control.save?.phase).toBe('error')
    }
    expect(storage.getItem(STATE_KEY)).toBeNull()
  })

  it('the verdict names the revision it is about — and only that one', () => {
    const storage = pickyStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    wiring.scheduleSave(store.present, emptyHistory)
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(wiring.control.save).toStrictEqual({ revision: 1, phase: 'error' })

    // A later change is a DIFFERENT revision: the failed one is not carried
    // over as if it had been the current state all along.
    wiring.scheduleSave(store.present, emptyHistory)
    expect(wiring.control.save).toStrictEqual({ revision: 2, phase: 'dirty' })
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(wiring.control.save).toStrictEqual({ revision: 2, phase: 'error' })

    // And the document is acquitted only once ITS write lands.
    storage.refuse = () => false
    wiring.scheduleSave(store.present, emptyHistory)
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(wiring.control.save).toStrictEqual({ revision: 3, phase: 'saved' })
    expect(stored(storage)).toEqual(testPortfolio())
  })

  it('the write itself is a state one can observe, and a change during it is not lost', () => {
    const inner = createMemoryStorage()
    const store = createStore(testPortfolio())
    const seen: (string | undefined)[] = []
    // The storage peeks at the wiring in the middle of the write, then makes a
    // change land there and then — the one moment an acknowledgement could
    // wrongly cover a state it never carried.
    const storage = observeWrites(inner, () => {
      seen.push(wiring.control.save?.phase)
      if (seen.length === 1) wiring.scheduleSave(store.present, emptyHistory)
    })
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    wiring.scheduleSave(store.present, emptyHistory)
    vi.advanceTimersByTime(SAVE_DELAY_MS)

    expect(seen).toStrictEqual(['saving'])
    // Revision 1 was written, but revision 2 arrived mid-write: the wiring
    // says «unsaved» about 2 rather than «saved» about 1.
    expect(wiring.control.save).toStrictEqual({ revision: 2, phase: 'dirty' })
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(wiring.control.save).toStrictEqual({ revision: 2, phase: 'saved' })
  })
})

/**
 * TWO TABS, ONE STORAGE. Every write names the state it believes is there; a
 * storage that moved on yields a conflict, and NOT ONE BYTE is overwritten.
 * Nothing merges by itself — the user picks. The guard is not a lock (see the
 * policy's header): what is pinned here is that the tab which lost is TOLD.
 */
describe('the guarded write between tabs', () => {
  /** This tab booted on revision 1; the other tab then saved its own. */
  const contendedSetup = () => {
    const storage = createMemoryStorage()
    const first = writtenStamp(writeState(storage, null, testPortfolio(), emptyHistory))
    const found = readStored(storage)
    const { store, wiring } = bootedOn(storage, found)
    effect(wiring, store) // the mounting effect's echo
    // …and now the OTHER tab writes revision 2 behind this one's back.
    writeState(storage, first, otherPortfolio(), emptyHistory)
    storage.writes = 0
    return { storage, store, wiring, first }
  }

  it('refuses to overwrite what the other tab wrote, and says so', () => {
    const { storage, store, wiring } = contendedSetup()

    editTitle(store, 'Ma version')
    effect(wiring, store)
    vi.advanceTimersByTime(SAVE_DELAY_MS)

    expect(wiring.control.save).toStrictEqual({ revision: 1, phase: 'conflict' })
    expect(storage.writes).toBe(0)
    expect(stored(storage)).toEqual(otherPortfolio()) // theirs, untouched
  })

  it('warns as soon as the browser says so, without waiting for a deadline', () => {
    const { storage, store, wiring } = contendedSetup()

    // An edit is armed; the `storage` event arrives first.
    editTitle(store, 'Ma version')
    effect(wiring, store)
    wiring.noticeStoredChange()
    expect(wiring.control.save).toStrictEqual({ revision: 1, phase: 'conflict' })

    // And the armed save is disarmed with it: the deadline writes nothing.
    vi.advanceTimersByTime(SAVE_DELAY_MS * 10)
    expect(storage.writes).toBe(0)
    expect(stored(storage)).toEqual(otherPortfolio())
  })

  it('says nothing when the storage still holds what this tab last saw', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    effect(wiring, store)
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    wiring.noticeStoredChange() // an unrelated key, or our own write echoing

    expect(wiring.control.save?.phase).toBe('saved')
  })

  it('a conflict over a document of the SAME revision number is still a conflict', () => {
    // THE FAILURE A COUNTER CANNOT SEE. The other tab booted on revision 1 too,
    // so the document it writes carries the very number this tab just wrote:
    // comparing numbers, the two states look identical, and the overwrite
    // passes unnoticed. Comparing the bytes' STAMP, it does not.
    const storage = createMemoryStorage()
    const first = writtenStamp(writeState(storage, null, testPortfolio(), emptyHistory))
    const staleBytes = storage.getItem(STATE_KEY)
    const found = readStored(storage)
    const { store, wiring } = bootedOn(storage, found)

    effect(wiring, store) // the echo
    editTitle(store, 'Ma version')
    effect(wiring, store)
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(revisionInStorage(storage)).toBe(2)
    expect(wiring.control.save?.phase).toBe('saved')

    // The other tab's guard read revision 1 before this one wrote; its own
    // `setItem` lands anyway — the window `writeState` describes and cannot
    // close. It writes revision 2, exactly like this tab did.
    const inTheWindow: KeyValueStorage = {
      getItem: () => staleBytes,
      setItem: (k, v) => storage.setItem(k, v),
      removeItem: (k) => storage.removeItem(k),
    }
    writtenStamp(writeState(inTheWindow, first, otherPortfolio(), emptyHistory))
    expect(revisionInStorage(storage)).toBe(2) // the same number…

    wiring.noticeStoredChange()
    expect(wiring.control.save?.phase).toBe('conflict') // …and it is heard
    expect(stored(storage)).toEqual(otherPortfolio()) // nothing overwritten since
  })

  it('takeStored() loads the other tab’s document — undoably — and saves on top', () => {
    const { storage, store, wiring } = contendedSetup()
    wiring.noticeStoredChange()

    wiring.control.takeStored()

    expect(store.present).toEqual(otherPortfolio())
    expect(store.canUndo).toBe(true) // an ordinary replacement, Ctrl+Z away
    expect(wiring.control.save?.phase).toBe('saved')
    expect(revisionInStorage(storage)).toBe(3)
  })

  it('keepMine() is the deliberate overwrite: this document wins, once asked', () => {
    const { storage, store, wiring } = contendedSetup()
    wiring.noticeStoredChange()

    wiring.control.keepMine()

    expect(store.present).toEqual(testPortfolio())
    expect(store.canUndo).toBe(false) // nothing was replaced in memory
    expect(stored(storage)).toEqual(testPortfolio())
    expect(wiring.control.save?.phase).toBe('saved')
  })

  it('a conflict raised by the other tab ERASING the storage resolves too', () => {
    const { storage, store, wiring } = contendedSetup()
    storage.removeItem(STATE_KEY) // the other tab switched its local save off
    wiring.noticeStoredChange()
    expect(wiring.control.save?.phase).toBe('conflict')

    wiring.control.takeStored() // there is nothing to take: this one stays
    expect(store.present).toEqual(testPortfolio())
    expect(stored(storage)).toEqual(testPortfolio())
    expect(revisionInStorage(storage)).toBe(1)
  })

  it('the two answers are inert outside a conflict', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    wiring.control.takeStored()
    wiring.control.keepMine()
    expect(storage.writes).toBe(0)
  })

  it('an UNREADABLE storage met at a conflict blocks the wiring, on either answer', () => {
    for (const answer of ['takeStored', 'keepMine'] as const) {
      const { storage, wiring } = contendedSetup()
      wiring.noticeStoredChange()
      storage.setItem(STATE_KEY, '{"format":1,"revision":9,"portfolio":{"version":1}}')
      storage.writes = 0

      wiring.control[answer]()

      // The invariant outranks the answer: bytes nobody could read are never
      // written over, whichever button was pressed.
      expect(wiring.blocked).toBe(true)
      expect(storage.writes).toBe(0)
    }
  })
})

/**
 * THE INVARIANT: data the application failed to read back is never written
 * over. Every write path of the wiring is tried here against a storage holding
 * an unreadable envelope — the point is not that one path is guarded but that
 * NONE of them is open.
 */
describe('blocked on an unreadable stored state', () => {
  const CORRUPT = '{"format":1,"revision":4,"portfolio":{"version":1,"was":"a portfolio, once"}}'

  /** A storage holding data the parse refuses, and a wiring born blocked. */
  const blockedSetup = (enabled: boolean) => {
    const storage = createMemoryStorage()
    storage.setItem(STATE_KEY, CORRUPT)
    storage.writes = 0 // the seeding is not the wiring's doing
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(
      store,
      storage,
      enabled,
      timeoutScheduler,
      readStored(storage),
    )
    return { storage, store, wiring }
  }

  it('starts blocked, and says so', () => {
    const { wiring } = blockedSetup(true)
    expect(wiring.blocked).toBe(true)
    expect(wiring.unreadable?.raw).toBe(CORRUPT)
  })

  it('writes nothing through the debounced save, deadline or no deadline', () => {
    const { storage, store, wiring } = blockedSetup(true)

    wiring.scheduleSave(store.present, emptyHistory)
    vi.advanceTimersByTime(SAVE_DELAY_MS * 10)

    expect(storage.getItem(STATE_KEY)).toBe(CORRUPT)
    expect(storage.writes).toBe(0)
  })

  it('writes nothing through the pagehide flush', () => {
    const { storage, store, wiring } = blockedSetup(true)

    wiring.scheduleSave(store.present, emptyHistory)
    wiring.flush()

    expect(storage.getItem(STATE_KEY)).toBe(CORRUPT)
    expect(storage.writes).toBe(0)
  })

  it('ignores the cross-tab signal: blocked outranks everything', () => {
    const { storage, wiring } = blockedSetup(true)
    wiring.noticeStoredChange()
    expect(wiring.blocked).toBe(true)
    expect(storage.getItem(STATE_KEY)).toBe(CORRUPT)
  })

  /* The switch is the one path that writes WITHOUT a debounce, and the one
     that erases: both directions are the recovery screen's call, not its. */
  it('ignores the local-save switch, in both directions', () => {
    const { storage, wiring } = blockedSetup(false)

    wiring.control.toggle(true)
    expect(wiring.control.enabled).toBe(false)
    expect(storage.getItem(STATE_KEY)).toBe(CORRUPT)

    const armed = blockedSetup(true)
    armed.wiring.control.toggle(false)
    expect(armed.wiring.control.enabled).toBe(true)
    expect(armed.storage.getItem(STATE_KEY)).toBe(CORRUPT)
    expect(armed.storage.writes).toBe(0)
  })

  it('discard() — the explicit decision — erases, then lets writes resume', () => {
    const { storage, store, wiring } = blockedSetup(true)

    wiring.discard()

    expect(wiring.blocked).toBe(false)
    // Erased, not overwritten: the next boot finds nothing rather than the
    // blob the user just abandoned.
    expect(storage.getItem(STATE_KEY)).toBeNull()
    expect(wiring.control.save?.phase).toBe('dirty')

    wiring.scheduleSave(store.present, emptyHistory)
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(stored(storage)).toEqual(testPortfolio())
  })

  it('discard() is not a general erase: on a wiring that was never blocked it does nothing', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, true, timeoutScheduler)

    wiring.control.toggle(true)
    wiring.discard()

    expect(stored(storage)).toEqual(testPortfolio())
  })
})

/**
 * THE SAME INVARIANT AT THE SWITCH — the path a boot cannot see. Local save
 * OFF, a document sitting in the storage: turning the save back on used to
 * write the open one straight over it. It now READS first, and the three
 * outcomes below are the whole of the rule.
 */
describe('turning the save back on reads the storage first', () => {
  /** A storage already holding `seeded`, and a wiring on ANOTHER document. */
  const seededSetup = (seeded: Portfolio) => {
    const storage = createMemoryStorage()
    writeState(storage, null, seeded, emptyHistory)
    storage.writes = 0
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(
      store,
      storage,
      false,
      timeoutScheduler,
      readStored(storage),
    )
    return { storage, store, wiring }
  }

  it('a readable document suspends the switch: nothing written, nothing enabled', () => {
    const { storage, wiring } = seededSetup(otherPortfolio())

    wiring.control.toggle(true)

    expect(wiring.control.pendingRestore).toBe(true)
    expect(wiring.control.enabled).toBe(false)
    expect(storage.writes).toBe(0)
    expect(storage.getItem(PREF_KEY)).toBeNull()
    expect(stored(storage)).toEqual(otherPortfolio())
  })

  it('restore() loads the stored copy — undoably — and then saves', () => {
    const { storage, store, wiring } = seededSetup(otherPortfolio())

    wiring.control.toggle(true)
    wiring.control.restore()

    expect(store.present).toEqual(otherPortfolio())
    expect(store.canUndo).toBe(true) // an ordinary replacement, Ctrl+Z away
    expect(wiring.control.enabled).toBe(true)
    expect(wiring.control.pendingRestore).toBe(false)
    expect(stored(storage)).toEqual(otherPortfolio())
    expect(revisionInStorage(storage)).toBe(2) // written against what was read
  })

  it('keepOpen() is the deliberate overwrite: the open document wins, once asked', () => {
    const { storage, store, wiring } = seededSetup(otherPortfolio())

    wiring.control.toggle(true)
    wiring.control.keepOpen()

    expect(store.present).toEqual(testPortfolio())
    expect(wiring.control.enabled).toBe(true)
    expect(stored(storage)).toEqual(testPortfolio())
  })

  it('dismissRestore() steps back: the stored copy is intact and the save stays off', () => {
    const { storage, wiring } = seededSetup(otherPortfolio())

    wiring.control.toggle(true)
    wiring.control.dismissRestore()

    expect(wiring.control.pendingRestore).toBe(false)
    expect(wiring.control.enabled).toBe(false)
    expect(storage.writes).toBe(0)
    expect(stored(storage)).toEqual(otherPortfolio())
  })

  it('an UNREADABLE document met at the switch blocks the wiring, exactly as at boot', () => {
    const storage = createMemoryStorage()
    const raw = '{"format":1,"revision":2,"portfolio":{"version":1,"was":"a portfolio"}}'
    storage.setItem(STATE_KEY, raw)
    storage.writes = 0
    const store = createStore(testPortfolio())
    // Nothing was stored when this wiring was built: the storage was written
    // to behind its back, which is exactly how this case happens.
    const wiring = createPersistenceControl(store, storage, false, timeoutScheduler)

    wiring.control.toggle(true)

    expect(wiring.blocked).toBe(true)
    expect(wiring.unreadable?.raw).toBe(raw)
    expect(wiring.control.enabled).toBe(false)
    expect(storage.writes).toBe(0)
  })

  it('the decision hooks are inert when nothing is pending', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, false, timeoutScheduler)

    wiring.control.restore()
    wiring.control.keepOpen()
    wiring.control.dismissRestore()

    expect(wiring.control.enabled).toBe(false)
    expect(storage.writes).toBe(0)
  })

  it('with no storage at all the switch is inert — it governs nothing', () => {
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, null, false, timeoutScheduler)

    // A switch that moves but changes nothing is worse than no switch: the
    // person would read "on" and believe their work is being kept.
    wiring.control.toggle(true)
    expect(wiring.control.enabled).toBe(false)
    expect(wiring.control.pendingRestore).toBe(false)
    wiring.control.toggle(false)
    expect(wiring.control.enabled).toBe(false)
  })
})

/**
 * THE FIRST EDIT AFTER A DECISION IS NOT AN ECHO — the fault this block
 * exists for. The anti-echo used to be a boolean armed at boot and cleared by
 * whichever save came first; `keepOpen()` wrote WITHOUT clearing it, so the
 * user's next edit was swallowed as if it were the boot's echo and the close
 * stored the document from before it. It is now the document itself that is
 * remembered, so only the document already in the storage is ever skipped.
 *
 * Each path below does exactly what the fault needed: one decision, ONE edit,
 * then the close.
 */
describe('the first edit after a write is saved, on every path that writes', () => {
  /** A storage already holding `seeded`, and a wiring on ANOTHER document —
   * the local save switched off, as it is when the question can arise. */
  const offWithStored = (seeded: Portfolio) => {
    const storage = createMemoryStorage()
    writeState(storage, null, seeded, emptyHistory)
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(
      store,
      storage,
      false,
      timeoutScheduler,
      readStored(storage),
    )
    return { storage, store, wiring }
  }

  /** One edit, the effect it triggers, and the page going away. */
  const editThenClose = (store: Store, wiring: PersistenceWiring, title: string): void => {
    editTitle(store, title)
    effect(wiring, store)
    wiring.flush() // 'pagehide'
  }

  it('keepOpen(): the open document wins, and what is typed next is stored', () => {
    const { storage, store, wiring } = offWithStored(otherPortfolio())
    wiring.control.toggle(true)
    wiring.control.keepOpen()

    editThenClose(store, wiring, 'Après keepOpen')
    expect(storedTitle(storage)).toBe('Après keepOpen')
  })

  it('restore(): the stored copy is loaded, and what is typed next is stored', () => {
    const { storage, store, wiring } = offWithStored(otherPortfolio())
    wiring.control.toggle(true)
    wiring.control.restore()

    editThenClose(store, wiring, 'Après restore')
    expect(storedTitle(storage)).toBe('Après restore')
  })

  it('activation on an empty storage: what is typed next is stored', () => {
    const storage = createMemoryStorage()
    const store = createStore(testPortfolio())
    const wiring = createPersistenceControl(store, storage, false, timeoutScheduler)
    wiring.control.toggle(true)

    editThenClose(store, wiring, 'Après activation')
    expect(storedTitle(storage)).toBe('Après activation')
  })

  it('and the document already in there is still skipped, however often it is offered', () => {
    // The other half of the rule: what is NOT an edit must not be announced to
    // the other tabs. A restored boot echoed twice writes nothing at all.
    const storage = createMemoryStorage()
    writeState(storage, null, testPortfolio(), emptyHistory)
    const { store, wiring } = bootedOn(storage, readStored(storage))
    storage.writes = 0

    effect(wiring, store)
    effect(wiring, store)
    wiring.flush()
    vi.advanceTimersByTime(SAVE_DELAY_MS)
    expect(storage.writes).toBe(0)
    expect(wiring.control.save).toStrictEqual({ revision: 0, phase: 'saved' })
  })
})
