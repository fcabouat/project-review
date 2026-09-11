/**
 * Pins the persistence policy (`src/services/persistence.ts`) on its two
 * in-memory doubles: the round trip of the stored ENVELOPE, the opt-out
 * preference, the compare-and-swap that guards every write, and the debounce
 * driven by a manual scheduler (no real clock in the business tests —
 * production time is the infrastructure's `timeoutScheduler`).
 *
 * The laws under test, and why each one matters:
 *  - ONE envelope: portfolio and undo/redo log are written together or not at
 *    all, so a log can never describe a document that is not there;
 *  - reading is a verdict: `absent`, `restored`, `unreadable` — never a silent
 *    "start empty" that would let a caller overwrite the only copy;
 *  - writing is a compare-and-swap: a storage that moved on since the caller
 *    last read it yields `conflict`, and NOT ONE BYTE moves.
 */

import { describe, expect, it } from 'vitest'
import type { DomainEvent } from '../../src/events'
import { HISTORY_LIMIT, emptyHistory } from '../../src/events/history'
import {
  PREF_KEY,
  SAVE_DELAY_MS,
  STATE_FORMAT,
  STATE_KEY,
  clearStored,
  debounce,
  loadPersistEnabled,
  readStored,
  savePersistEnabled,
  storedRevision,
  writeState,
  type KeyValueStorage,
} from '../../src/services/persistence'
import { otherPortfolio, testPortfolio } from '../fixtures/hand-built-portfolios'
import { createManualScheduler, createMemoryStorage } from '../fixtures/persistence-doubles'

/** The document as it comes back out, or `null` when it did not. */
const restored = (storage: KeyValueStorage) => {
  const back = readStored(storage)
  return back.state === 'restored' ? back : null
}

/** Seeds an envelope by hand — the only way to stage a state no write path
 * could produce (a hand-edited storage, another build's format). */
const seed = (storage: KeyValueStorage, envelope: unknown): void =>
  storage.setItem(STATE_KEY, JSON.stringify(envelope))

/** `history` stays `unknown`: half of these tests stage a log no typed
 * writer could ever produce — a hand-edited storage. */
const wholeEnvelope = (revision: number, history: unknown = emptyHistory) => ({
  format: STATE_FORMAT,
  revision,
  portfolio: testPortfolio(),
  history,
})

describe('writeState / readStored — one envelope, one key', () => {
  it('makes the round trip without losing the portfolio nor the log', () => {
    const storage = createMemoryStorage()
    const history = {
      past: [{ type: 'ReviewFieldChanged', field: 'title', before: 'a', after: 'b' }],
      future: [{ type: 'SettingChanged', setting: 'language', before: 'fr', after: 'en' }],
    } as const

    expect(writeState(storage, null, testPortfolio(), history)).toStrictEqual({
      outcome: 'written',
      revision: 1,
    })

    const back = restored(storage)!
    expect(back.revision).toBe(1)
    // `toEqual`, not `toStrictEqual`: the round trip through the FORMAT
    // normalises an explicitly-undefined optional into an absent one — the
    // parse's own rule (absence is the meaningful state). No value is lost.
    expect(back.portfolio).toEqual(testPortfolio())
    expect(back.history).toEqual(history)
  })

  it('writes ONE key — the log has no home of its own to drift from', () => {
    const storage = createMemoryStorage()
    writeState(storage, null, testPortfolio(), emptyHistory)
    expect(STATE_KEY).toBe('project-review/state')
    expect([...storage.content.keys()]).toStrictEqual([STATE_KEY])
    expect(storage.writes).toBe(1)
  })

  it('numbers the revisions monotonically, one per write', () => {
    const storage = createMemoryStorage()
    expect(writeState(storage, null, testPortfolio(), emptyHistory)).toStrictEqual({
      outcome: 'written',
      revision: 1,
    })
    expect(writeState(storage, 1, otherPortfolio(), emptyHistory)).toStrictEqual({
      outcome: 'written',
      revision: 2,
    })
    expect(restored(storage)!.portfolio).toEqual(otherPortfolio())
    expect(storage.content.size).toBe(1)
  })

  it('says `absent` when nothing is stored — and only then', () => {
    expect(readStored(createMemoryStorage())).toStrictEqual({ state: 'absent' })
  })

  /* The whole point of the three-way verdict: "stored but unreadable" can
     never be mistaken for "nothing stored", whatever the reason — because the
     caller that confuses them overwrites the only copy of the data. */
  it('says `unreadable` on content that is not JSON, and hands the bytes back', () => {
    const storage = createMemoryStorage()
    storage.setItem(STATE_KEY, '{ this is not JSON')
    const back = readStored(storage)
    if (back.state !== 'unreadable') throw new Error('expected an unreadable state')
    expect(back.raw).toBe('{ this is not JSON')
    expect(back.refusal).toStrictEqual({ ok: false, refusal: 'badJson' })
  })

  it('says `unreadable` on a payload beyond the size cap, without parsing it', () => {
    const storage = createMemoryStorage()
    storage.setItem(STATE_KEY, `"${'x'.repeat(10_000_001)}"`)
    const back = readStored(storage)
    if (back.state !== 'unreadable') throw new Error('expected an unreadable state')
    expect(back.refusal).toStrictEqual({ ok: false, refusal: 'tooLarge' })
  })

  it('says `unreadable` on an envelope this build cannot open', () => {
    const storage = createMemoryStorage()
    for (const envelope of [
      42,
      null,
      { format: STATE_FORMAT + 1, revision: 1, portfolio: testPortfolio(), history: emptyHistory },
      { revision: 1, portfolio: testPortfolio() },
      { format: STATE_FORMAT, revision: 0, portfolio: testPortfolio() },
      { format: STATE_FORMAT, revision: 1.5, portfolio: testPortfolio() },
      { format: STATE_FORMAT, revision: 'one', portfolio: testPortfolio() },
    ]) {
      seed(storage, envelope)
      const back = readStored(storage)
      if (back.state !== 'unreadable') throw new Error(`expected a refusal for ${back.state}`)
      expect(back.refusal).toStrictEqual({ ok: false, refusal: 'unknownFormat' })
    }
  })

  it('says `unreadable` with the FULL report when the portfolio breaks the contract', () => {
    const storage = createMemoryStorage()
    seed(storage, { format: STATE_FORMAT, revision: 4, portfolio: { version: 1, nonsense: true } })
    const back = readStored(storage)
    if (back.state !== 'unreadable') throw new Error('expected an unreadable state')
    if ('refusal' in back.refusal) throw new Error('expected a parse report')
    expect(back.refusal.errors.length).toBeGreaterThan(0)
  })

  it('never throws, whatever sits in the storage', () => {
    const storage = createMemoryStorage()
    for (const junk of ['', 'null', '[]', '"text"', '0', '{']) {
      storage.setItem(STATE_KEY, junk)
      expect(() => readStored(storage)).not.toThrow()
      expect(readStored(storage).state).toBe('unreadable')
    }
  })
})

describe('the log rides inside the envelope', () => {
  it('drops a misshapen log in silence and keeps the portfolio', () => {
    const storage = createMemoryStorage()
    for (const history of [
      undefined,
      42,
      null,
      { past: 'nope', future: [] },
      { past: [], future: 'nope' },
      { past: [{ notype: true }], future: [] },
      { past: [null], future: [] },
      { past: [], future: ['x'] },
    ]) {
      seed(storage, { ...wholeEnvelope(1), history })
      const back = restored(storage)
      // The portfolio in the same bytes just passed the strict parse: losing
      // undo steps is not losing the document, and refusing the envelope over
      // them would cost the user far more than it protects.
      expect(back?.portfolio).toEqual(testPortfolio())
      expect(back?.history).toStrictEqual(emptyHistory)
    }
  })

  it('drops a log whose PortfolioReplaced carries a forged portfolio', () => {
    // localStorage is user-editable: a stored PortfolioReplaced embeds two
    // whole portfolios that undo/redo would install verbatim, so both sides
    // repass the strict parse — one forged side throws the log away.
    const storage = createMemoryStorage()
    const replaced = (after: unknown) => [
      { type: 'PortfolioReplaced', before: testPortfolio(), after },
    ]

    seed(storage, wholeEnvelope(1, { past: replaced({ version: 3, forged: true }), future: [] }))
    expect(restored(storage)!.history).toStrictEqual(emptyHistory)

    // Same guard on the future stack (an undone import is still an import),
    // and on the `before` side.
    seed(storage, wholeEnvelope(1, { past: [], future: replaced({}) }))
    expect(restored(storage)!.history).toStrictEqual(emptyHistory)
    seed(
      storage,
      wholeEnvelope(1, {
        past: [{ type: 'PortfolioReplaced', before: 42, after: otherPortfolio() }],
        future: [],
      }),
    )
    expect(restored(storage)!.history).toStrictEqual(emptyHistory)

    // A SOUND PortfolioReplaced round-trips whole: the guard refuses forgery,
    // never the legitimate import it exists to protect.
    const sound = { past: replaced(otherPortfolio()), future: [] }
    seed(storage, wholeEnvelope(1, sound))
    expect(restored(storage)!.history).toEqual(sound)
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

    writeState(storage, null, testPortfolio(), { past, future: [event(999)] })

    const back = restored(storage)!.history
    expect(back.past).toHaveLength(HISTORY_LIMIT)
    expect(back.past[0]).toEqual(event(3)) // the 3 oldest dropped
    expect(back.past.at(-1)).toEqual(event(HISTORY_LIMIT + 2))
    expect(back.future).toHaveLength(1) // future is small by nature: untouched
  })
})

describe('storedRevision — the compare half of the swap', () => {
  it('reads the announced revision off the head, without parsing the document', () => {
    const storage = createMemoryStorage()
    expect(storedRevision(storage)).toBeNull()
    writeState(storage, null, testPortfolio(), emptyHistory)
    expect(storedRevision(storage)).toBe(1)
    writeState(storage, 1, testPortfolio(), emptyHistory)
    expect(storedRevision(storage)).toBe(2)
  })

  it('calls anything it does not recognise `unreadable` — never a licence to write', () => {
    const storage = createMemoryStorage()
    for (const raw of [
      '{ this is not JSON',
      '{"revision":3,"format":1,"portfolio":{}}', // right keys, wrong order
      JSON.stringify({ format: STATE_FORMAT + 1, revision: 1, portfolio: {} }),
      JSON.stringify({ format: STATE_FORMAT, revision: 0, portfolio: {} }),
    ]) {
      storage.setItem(STATE_KEY, raw)
      expect(storedRevision(storage)).toBe('unreadable')
    }
  })
})

describe('the compare-and-swap', () => {
  it('refuses to overwrite a storage that moved on, and touches nothing', () => {
    const storage = createMemoryStorage()
    writeState(storage, null, testPortfolio(), emptyHistory) // the other tab
    const before = storage.getItem(STATE_KEY)
    const writes = storage.writes

    // This caller still believes the storage is empty — the exact situation of
    // a second tab that loaded before the first one saved.
    expect(writeState(storage, null, otherPortfolio(), emptyHistory)).toStrictEqual({
      outcome: 'conflict',
    })
    expect(storage.getItem(STATE_KEY)).toBe(before)
    expect(storage.writes).toBe(writes)
  })

  it('refuses just as firmly when the stored bytes cannot be read at all', () => {
    const storage = createMemoryStorage()
    storage.setItem(STATE_KEY, 'hand-edited nonsense')
    expect(writeState(storage, null, testPortfolio(), emptyHistory)).toStrictEqual({
      outcome: 'conflict',
    })
    expect(storage.getItem(STATE_KEY)).toBe('hand-edited nonsense')
  })

  it('lets the write through on an exact match, in both directions', () => {
    const storage = createMemoryStorage()
    expect(writeState(storage, 7, testPortfolio(), emptyHistory)).toStrictEqual({
      outcome: 'conflict',
    }) // expecting 7 where nothing is stored
    writeState(storage, null, testPortfolio(), emptyHistory)
    expect(writeState(storage, 2, testPortfolio(), emptyHistory)).toStrictEqual({
      outcome: 'conflict',
    }) // expecting 2 where 1 is stored
    expect(writeState(storage, 1, testPortfolio(), emptyHistory).outcome).toBe('written')
  })
})

describe('local-save preference and total writes', () => {
  it('is on by default and remembers being switched off', () => {
    const storage = createMemoryStorage()
    expect(loadPersistEnabled(storage)).toBe(true)
    savePersistEnabled(storage, false)
    expect(loadPersistEnabled(storage)).toBe(false)
    savePersistEnabled(storage, true)
    expect(loadPersistEnabled(storage)).toBe(true)
  })

  it('a storage that throws makes the writes total, never propagating', () => {
    const broken: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError')
      },
      removeItem: () => {},
    }
    expect(writeState(broken, null, testPortfolio(), emptyHistory)).toStrictEqual({
      outcome: 'refused',
    })
    expect(savePersistEnabled(broken, true)).toBe(false)

    const fine = createMemoryStorage()
    expect(writeState(fine, null, testPortfolio(), emptyHistory).outcome).toBe('written')
    expect(savePersistEnabled(fine, false)).toBe(true)
  })

  it('clearStored erases the document but keeps the preference', () => {
    const storage = createMemoryStorage()
    writeState(storage, null, testPortfolio(), emptyHistory)
    savePersistEnabled(storage, true)
    clearStored(storage)
    expect(storage.getItem(STATE_KEY)).toBeNull()
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
    let base: number | null = null
    const record = debounce(
      (p: ReturnType<typeof testPortfolio>) => {
        const outcome = writeState(storage, base, p, emptyHistory)
        if (outcome.outcome === 'written') base = outcome.revision
      },
      SAVE_DELAY_MS,
      clock.schedule,
    )

    record.run(testPortfolio())
    record.run(testPortfolio())
    record.run(otherPortfolio())
    expect(storage.writes).toBe(0)

    clock.fire()
    expect(storage.writes).toBe(1)
    expect(restored(storage)!.portfolio).toEqual(otherPortfolio())
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
    // erase; firing the clock afterwards must NOT resurrect the document.
    const storage = createMemoryStorage()
    const clock = createManualScheduler()
    let enabled = true
    const record = debounce(
      (p: ReturnType<typeof testPortfolio>) => {
        if (enabled) writeState(storage, null, p, emptyHistory)
      },
      SAVE_DELAY_MS,
      clock.schedule,
    )

    record.run(testPortfolio())
    enabled = false
    record.cancel()
    clearStored(storage)

    clock.fire()
    expect(storage.getItem(STATE_KEY)).toBeNull()
    expect(storage.content.size).toBe(0)
  })

  it('opt-out belt AND braces: even an un-cancelled deadline re-checks the flag', () => {
    const storage = createMemoryStorage()
    const clock = createManualScheduler()
    let enabled = true
    const record = debounce(
      (p: ReturnType<typeof testPortfolio>) => {
        if (enabled) writeState(storage, null, p, emptyHistory)
      },
      SAVE_DELAY_MS,
      clock.schedule,
    )

    record.run(testPortfolio())
    enabled = false // toggle(false) without the cancel — the guard alone holds
    clock.fire()
    expect(storage.getItem(STATE_KEY)).toBeNull()
  })
})
