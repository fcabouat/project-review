/**
 * Pins the persistence policy (`src/services/persistence.ts`) on its two
 * in-memory doubles: snapshot round trip, opt-out preference, versioned
 * undo/redo log, and the debounce driven by a manual scheduler (no real clock
 * in the business tests — production time is the infrastructure's
 * `timeoutScheduler`).
 */

import { describe, expect, it } from 'vitest'
import type { DomainEvent } from '../../src/events'
import { HISTORY_LIMIT } from '../../src/events/history'
import {
  HISTORY_KEY,
  HISTORY_VERSION,
  PREF_KEY,
  SAVE_DELAY_MS,
  STORAGE_KEY,
  clearStored,
  debounce,
  loadHistory,
  loadPersistEnabled,
  loadRaw,
  save,
  saveHistory,
  savePersistEnabled,
  type KeyValueStorage,
} from '../../src/services/persistence'
import { otherPortfolio, testPortfolio } from '../fixtures/hand-built-portfolios'
import { createManualScheduler, createMemoryStorage } from '../fixtures/persistence-doubles'

describe('save / loadRaw', () => {
  it('makes the round trip without losing anything', () => {
    const storage = createMemoryStorage()
    const p = testPortfolio()

    save(storage, p)

    expect(loadRaw(storage)).toStrictEqual(JSON.parse(JSON.stringify(p)))
    // The fixture holds no non-serializable value: equality is strict.
    expect(loadRaw(storage)).toStrictEqual(p)
  })

  it('writes under the agreed key', () => {
    const storage = createMemoryStorage()
    save(storage, testPortfolio())
    expect(STORAGE_KEY).toBe('project-review/portfolio')
    expect(storage.content.has(STORAGE_KEY)).toBe(true)
  })

  it('overwrites the previous save', () => {
    const storage = createMemoryStorage()
    save(storage, testPortfolio())
    save(storage, otherPortfolio())
    expect(loadRaw(storage)).toStrictEqual(otherPortfolio())
    expect(storage.content.size).toBe(1)
  })

  it('returns null when nothing is stored', () => {
    expect(loadRaw(createMemoryStorage())).toBeNull()
  })

  it('returns null on unreadable content rather than throwing', () => {
    const storage = createMemoryStorage()
    storage.setItem(STORAGE_KEY, '{ ceci n’est pas du JSON')
    expect(() => loadRaw(storage)).not.toThrow()
    expect(loadRaw(storage)).toBeNull()
  })

  it('validates nothing: the total parse stays with the caller', () => {
    const storage = createMemoryStorage()
    storage.setItem(STORAGE_KEY, '{"version":1,"nawak":true}')
    expect(loadRaw(storage)).toStrictEqual({ version: 1, nawak: true })
  })
})

describe('local-save preference and stored history', () => {
  it('is on by default and remembers being switched off', () => {
    const storage = createMemoryStorage()
    expect(loadPersistEnabled(storage)).toBe(true)
    savePersistEnabled(storage, false)
    expect(loadPersistEnabled(storage)).toBe(false)
    savePersistEnabled(storage, true)
    expect(loadPersistEnabled(storage)).toBe(true)
  })

  it('round-trips the undo/redo history', () => {
    const storage = createMemoryStorage()
    const history = {
      past: [{ type: 'ReviewFieldChanged', field: 'title', before: 'a', after: 'b' }],
      future: [{ type: 'SettingChanged', setting: 'language', before: 'fr', after: 'en' }],
    } as const
    saveHistory(storage, history)
    expect(loadHistory(storage)).toEqual(history)
  })

  it('returns null on an absent, corrupted or misshapen history', () => {
    const storage = createMemoryStorage()
    expect(loadHistory(storage)).toBeNull()
    storage.setItem(HISTORY_KEY, '{oops')
    expect(loadHistory(storage)).toBeNull()
    // Valid JSON that is not even an object: a number, the null literal.
    storage.setItem(HISTORY_KEY, '42')
    expect(loadHistory(storage)).toBeNull()
    storage.setItem(HISTORY_KEY, 'null')
    expect(loadHistory(storage)).toBeNull()
    storage.setItem(
      HISTORY_KEY,
      JSON.stringify({ v: HISTORY_VERSION, past: [{ notype: true }], future: [] }),
    )
    expect(loadHistory(storage)).toBeNull()
    // The shallow shape check walks every element: null and non-objects too.
    storage.setItem(HISTORY_KEY, JSON.stringify({ v: HISTORY_VERSION, past: [null], future: [] }))
    expect(loadHistory(storage)).toBeNull()
    storage.setItem(HISTORY_KEY, JSON.stringify({ v: HISTORY_VERSION, past: [], future: ['x'] }))
    expect(loadHistory(storage)).toBeNull()
  })

  it('discards a history whose PortfolioReplaced carries a forged portfolio', () => {
    // localStorage is user-editable: a stored PortfolioReplaced embeds two
    // whole portfolios that undo/redo would install verbatim, so both sides
    // repass the strict parse — one forged side throws the whole history away
    // (the snapshot, revalidated at startup, survives on its own).
    const storage = createMemoryStorage()
    const replaced = (after: unknown) => ({
      v: HISTORY_VERSION,
      past: [{ type: 'PortfolioReplaced', before: testPortfolio(), after }],
      future: [],
    })

    storage.setItem(HISTORY_KEY, JSON.stringify(replaced({ version: 3, forged: true })))
    expect(loadHistory(storage)).toBeNull()

    // Same guard on the future stack (an undone import is still an import),
    // and on the `before` side.
    storage.setItem(
      HISTORY_KEY,
      JSON.stringify({ v: HISTORY_VERSION, past: [], future: replaced({}).past }),
    )
    expect(loadHistory(storage)).toBeNull()
    storage.setItem(
      HISTORY_KEY,
      JSON.stringify({
        v: HISTORY_VERSION,
        past: [{ type: 'PortfolioReplaced', before: 42, after: otherPortfolio() }],
        future: [],
      }),
    )
    expect(loadHistory(storage)).toBeNull()

    // A SOUND PortfolioReplaced round-trips whole: the guard refuses forgery,
    // never the legitimate import it exists to protect.
    const sound = replaced(otherPortfolio())
    storage.setItem(HISTORY_KEY, JSON.stringify(sound))
    expect(loadHistory(storage)).toEqual({ past: sound.past, future: [] })
  })

  it('stamps the schema version and discards a history stamped otherwise', () => {
    const storage = createMemoryStorage()
    saveHistory(storage, { past: [], future: [] })
    expect(JSON.parse(storage.getItem(HISTORY_KEY)!)).toMatchObject({ v: HISTORY_VERSION })

    // Pre-stamp payload (or another schema): events not replayable → discarded.
    storage.setItem(HISTORY_KEY, JSON.stringify({ past: [], future: [] }))
    expect(loadHistory(storage)).toBeNull()
    storage.setItem(HISTORY_KEY, JSON.stringify({ v: HISTORY_VERSION + 1, past: [], future: [] }))
    expect(loadHistory(storage)).toBeNull()
  })

  it(`caps the stored past at ${HISTORY_LIMIT} events, dropping the oldest`, () => {
    const storage = createMemoryStorage()
    const event = (i: number): DomainEvent => ({
      type: 'ReviewFieldChanged',
      field: 'title',
      before: `t${i}`,
      after: `t${i + 1}`,
    })
    const past = Array.from({ length: HISTORY_LIMIT + 3 }, (_, i) => event(i))

    saveHistory(storage, { past, future: [event(999)] })

    const stored = loadHistory(storage)!
    expect(stored.past).toHaveLength(HISTORY_LIMIT)
    expect(stored.past[0]).toEqual(event(3)) // the 3 oldest dropped
    expect(stored.past.at(-1)).toEqual(event(HISTORY_LIMIT + 2))
    expect(stored.future).toHaveLength(1) // future is small by nature: untouched
  })

  it('a storage that throws makes the writes return false, never propagate', () => {
    const broken: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError')
      },
      removeItem: () => {},
    }
    expect(save(broken, testPortfolio())).toBe(false)
    expect(saveHistory(broken, { past: [], future: [] })).toBe(false)
    expect(savePersistEnabled(broken, true)).toBe(false)

    const fine = createMemoryStorage()
    expect(save(fine, testPortfolio())).toBe(true)
    expect(saveHistory(fine, { past: [], future: [] })).toBe(true)
    expect(savePersistEnabled(fine, false)).toBe(true)
  })

  it('clearStored erases the data but keeps the preference', () => {
    const storage = createMemoryStorage()
    save(storage, testPortfolio())
    saveHistory(storage, { past: [], future: [] })
    savePersistEnabled(storage, true)
    clearStored(storage)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(storage.getItem(HISTORY_KEY)).toBeNull()
    expect(storage.getItem(PREF_KEY)).toBe('on')
  })
})

describe('debounce', () => {
  it('3 close calls → a single execution, with the last arguments', () => {
    const clock = createManualScheduler()
    const seen: string[] = []
    const f = debounce((x: string) => seen.push(x), 500, clock.schedule)

    f.run('a')
    f.run('b')
    f.run('c')
    expect(seen).toEqual([])

    clock.fire()
    expect(seen).toEqual(['c'])
    expect(clock.scheduled).toBe(3)
    expect(clock.cancelled).toBe(2)
  })

  it('replays on every burst', () => {
    const clock = createManualScheduler()
    let calls = 0
    const f = debounce(
      () => {
        calls += 1
      },
      500,
      clock.schedule,
    )

    f.run()
    f.run()
    clock.fire()
    f.run()
    clock.fire()

    expect(calls).toBe(2)
  })

  it('cancel disarms the pending call for good', () => {
    const clock = createManualScheduler()
    let calls = 0
    const f = debounce(
      () => {
        calls += 1
      },
      500,
      clock.schedule,
    )

    f.run()
    f.cancel()
    clock.fire()
    expect(calls).toBe(0)

    // A cancelled handle stays usable.
    f.run()
    clock.fire()
    expect(calls).toBe(1)
  })

  it('flush fires the pending call now, with the last arguments, exactly once', () => {
    const clock = createManualScheduler()
    const seen: string[] = []
    const f = debounce((x: string) => seen.push(x), 500, clock.schedule)

    f.run('a')
    f.run('b')
    f.flush()
    expect(seen).toEqual(['b'])

    // The deadline was cancelled by the flush: nothing fires twice.
    clock.fire()
    expect(seen).toEqual(['b'])
  })

  it('flush is a no-op when nothing is pending (fresh, fired or cancelled)', () => {
    const clock = createManualScheduler()
    let calls = 0
    const f = debounce(
      () => {
        calls += 1
      },
      500,
      clock.schedule,
    )

    f.flush()
    f.run()
    clock.fire()
    f.flush()
    f.run()
    f.cancel()
    f.flush()
    expect(calls).toBe(1)
  })
})

describe('debounced saving (the app wiring in miniature)', () => {
  it('condenses a burst of states into a single write', () => {
    const storage = createMemoryStorage()
    const clock = createManualScheduler()
    const record = debounce(
      (p: ReturnType<typeof testPortfolio>) => void save(storage, p),
      SAVE_DELAY_MS,
      clock.schedule,
    )

    record.run(testPortfolio())
    record.run(testPortfolio())
    record.run(otherPortfolio())
    expect(storage.writes).toBe(0)

    clock.fire()
    expect(storage.writes).toBe(1)
    expect(loadRaw(storage)).toStrictEqual(otherPortfolio())
  })

  it('rides the shared SAVE_DELAY_MS deadline', () => {
    const clock = createManualScheduler()
    debounce(() => {}, SAVE_DELAY_MS, clock.schedule).run()
    expect(clock.lastDelay).toBe(500)

    const explicit = createManualScheduler()
    debounce(() => {}, 250, explicit.schedule).run()
    expect(explicit.lastDelay).toBe(250)
  })

  it('opt-out before the deadline: cancel + clear leaves the storage empty', () => {
    // An edit arms the debounce, the user toggles local save OFF before the
    // 500 ms deadline. The armed save must die with the toggle — cancel, then
    // erase; firing the clock afterwards must NOT resurrect the snapshot.
    const storage = createMemoryStorage()
    const clock = createManualScheduler()
    let enabled = true
    const record = debounce(
      (p: ReturnType<typeof testPortfolio>) => {
        if (enabled) save(storage, p)
      },
      SAVE_DELAY_MS,
      clock.schedule,
    )

    record.run(testPortfolio())
    enabled = false
    record.cancel()
    clearStored(storage)

    clock.fire()
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(storage.content.size).toBe(0)
  })

  it('opt-out belt AND braces: even an un-cancelled deadline re-checks the flag', () => {
    const storage = createMemoryStorage()
    const clock = createManualScheduler()
    let enabled = true
    const record = debounce(
      (p: ReturnType<typeof testPortfolio>) => {
        if (enabled) save(storage, p)
      },
      SAVE_DELAY_MS,
      clock.schedule,
    )

    record.run(testPortfolio())
    enabled = false // toggle(false) without the cancel — the guard alone holds
    clock.fire()
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })
})
