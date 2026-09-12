/**
 * Pins the persistence policy (`src/services/persistence.ts`) on its two
 * in-memory doubles: the round trip of the stored ENVELOPE, the opt-out
 * preference, the guard that stands before every write, and the debounce
 * driven by a manual scheduler (no real clock in the business tests —
 * production time is the infrastructure's `timeoutScheduler`).
 *
 * The laws under test, and why each one matters:
 *  - ONE envelope: portfolio and undo/redo log are written together or not at
 *    all, so a log can never describe a document that is not there;
 *  - reading is a verdict: `absent`, `restored`, `unreadable` — never a silent
 *    "start empty" that would let a caller overwrite the only copy;
 *  - writing is guarded: a storage that moved on since the caller last read it
 *    yields `conflict`, and NOT ONE BYTE moves;
 *  - and the guard is NOT a lock. `localStorage` offers no mutual exclusion,
 *    so two documents can both pass the check and both write. What is pinned
 *    below is the property that survives that window: the state is named by a
 *    STAMP of its bytes, not by a counter, so the writer whose document was
 *    overwritten no longer recognises what is in there and is refused its next
 *    write. A lost write is announced; it is never silent.
 */

import { describe, expect, it } from 'vitest'
import type { DomainEvent } from '../../src/events'
import { HISTORY_LIMIT, emptyHistory } from '../../src/events/history'
import { MAX_CHARS, MAX_STORED_CHARS } from '../../src/model/budget'
import { readPortfolioJson } from '../../src/services/parse'
import { serializePortfolio } from '../../src/services/portfolio-json'
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
  storedStamp,
  writeState,
  type KeyValueStorage,
  type StateStamp,
  type WriteOutcome,
} from '../../src/services/persistence'
import { otherPortfolio, testPortfolio } from '../fixtures/hand-built-portfolios'
import { createManualScheduler, createMemoryStorage } from '../fixtures/persistence-doubles'

/** The document as it comes back out, or `null` when it did not. */
const restored = (storage: KeyValueStorage) => {
  const back = readStored(storage)
  return back.state === 'restored' ? back : null
}

/** The stamp a successful write handed back — and an assertion that it WAS
 * one, so a test can chain writes the way a tab does. */
const written = (outcome: WriteOutcome): StateStamp => {
  expect(outcome.outcome).toBe('written')
  return outcome.outcome === 'written' ? outcome.stamp : ''
}

/** The monotone number the stored envelope announces — read from the bytes,
 * since nothing outside the policy reads it off a stamp. */
const revisionInStorage = (storage: KeyValueStorage): unknown =>
  JSON.parse(storage.getItem(STATE_KEY)!).revision

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

    const stamp = written(writeState(storage, null, testPortfolio(), history))

    const back = restored(storage)!
    // The write hands back the identity of the bytes it left behind, and the
    // read finds the same one on the same bytes.
    expect(back.stamp).toBe(stamp)
    expect(storedStamp(storage)).toBe(stamp)
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
    const first = written(writeState(storage, null, testPortfolio(), emptyHistory))
    expect(revisionInStorage(storage)).toBe(1)
    const second = written(writeState(storage, first, otherPortfolio(), emptyHistory))
    expect(revisionInStorage(storage)).toBe(2)
    expect(first).not.toBe(second)
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

describe('storedStamp — the compare half of the guard', () => {
  it('names the stored bytes, and names the same bytes the same way twice', () => {
    const storage = createMemoryStorage()
    expect(storedStamp(storage)).toBeNull()
    const first = written(writeState(storage, null, testPortfolio(), emptyHistory))
    expect(storedStamp(storage)).toBe(first)
    // Read twice, same answer: the stamp is a function of the bytes, so a
    // caller can compare it against what it holds without re-reading anything.
    expect(storedStamp(storage)).toBe(first)
    const second = written(writeState(storage, first, otherPortfolio(), emptyHistory))
    expect(storedStamp(storage)).toBe(second)
  })

  it('tells two documents apart even when they carry the SAME revision number', () => {
    // The whole reason the stamp is not a counter. Two tabs that both start
    // from revision 1 both write revision 2; a counter cannot tell which of
    // the two is in the storage, and this is what that costs.
    const one = createMemoryStorage()
    const two = createMemoryStorage()
    const start = testPortfolio()
    const a = written(writeState(one, null, start, emptyHistory))
    const b = written(writeState(two, null, start, emptyHistory))
    expect(a).toBe(b) // same bytes, same name

    const afterA = written(writeState(one, a, testPortfolio(), emptyHistory))
    const afterB = written(writeState(two, b, otherPortfolio(), emptyHistory))
    expect(revisionInStorage(one)).toBe(2)
    expect(revisionInStorage(two)).toBe(2) // the counters agree…
    expect(afterA).not.toBe(afterB) // …the stamps do not
  })

  it('calls anything it does not recognise `unreadable` — never a licence to write', () => {
    const storage = createMemoryStorage()
    for (const raw of [
      '{ this is not JSON',
      '[1,2,3]',
      JSON.stringify({ format: STATE_FORMAT + 1, revision: 1, portfolio: {} }),
      JSON.stringify({ format: STATE_FORMAT, revision: 0, portfolio: {} }),
      JSON.stringify({ revision: 3, portfolio: {} }), // no format at all
    ]) {
      storage.setItem(STATE_KEY, raw)
      expect(storedStamp(storage)).toBe('unreadable')
      // …and an envelope the guard cannot open is not restorable either: a
      // caller holding a stamp nothing can match would be refused every write
      // it ever attempted, which is worse than being told now.
      expect(readStored(storage).state).toBe('unreadable')
    }
  })

  it('reads an envelope whose keys arrived in another order, head shortcut or not', () => {
    // Key order is free in JSON. A document another tool wrote, or a person
    // edited by hand, is a VALID document that simply does not start with
    // `format` — and « I could not read it quickly » is not a verdict on it.
    // Were it one, a healthy file would land its owner on the recovery screen.
    const storage = createMemoryStorage()
    const raw = JSON.stringify({
      savedBy: 'a spreadsheet, one afternoon',
      revision: 7,
      format: STATE_FORMAT,
      history: emptyHistory,
      portfolio: testPortfolio(),
    })
    storage.setItem(STATE_KEY, raw)

    const back = readStored(storage)
    if (back.state !== 'restored') throw new Error(`expected a restored state, got ${back.state}`)
    expect(back.portfolio).toEqual(testPortfolio())
    // The guard names the same bytes the same way the read did — otherwise the
    // caller holds a stamp nothing can match and every save is a `conflict`.
    expect(storedStamp(storage)).toBe(back.stamp)

    // And the number it read is the one the envelope announces: the next write
    // continues the count instead of restarting it.
    written(writeState(storage, back.stamp, otherPortfolio(), emptyHistory))
    expect(revisionInStorage(storage)).toBe(8)
  })
})

describe('the guarded write', () => {
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
    expect(writeState(storage, 'no-such-state', testPortfolio(), emptyHistory)).toStrictEqual({
      outcome: 'conflict',
    }) // naming a state where nothing is stored
    const stamp = written(writeState(storage, null, testPortfolio(), emptyHistory))
    expect(writeState(storage, 'some-other-state', testPortfolio(), emptyHistory)).toStrictEqual({
      outcome: 'conflict',
    }) // naming a state other than the one in there
    expect(writeState(storage, stamp, testPortfolio(), emptyHistory).outcome).toBe('written')
  })

  it('two documents interleaved on one storage: exactly one wins, and the other is TOLD', () => {
    // THE WINDOW THE GUARD CANNOT CLOSE, reproduced. Both tabs read the same
    // state and both pass the check; nothing makes the read and the write one
    // step, so the second `setItem` simply lands on the first. What is pinned
    // here is what happens NEXT — the loser must not go on believing its
    // document is the stored one.
    const shared = createMemoryStorage()
    const start = written(writeState(shared, null, testPortfolio(), emptyHistory))
    const staleBytes = shared.getItem(STATE_KEY)

    // B gets there first.
    const b = written(writeState(shared, start, otherPortfolio(), emptyHistory))

    // A's guard read the bytes BEFORE B wrote — a storage handing back what A
    // saw is exactly that window, and nothing in the policy can notice it.
    const inTheWindow: KeyValueStorage = {
      getItem: () => staleBytes,
      setItem: (k, v) => shared.setItem(k, v),
      removeItem: (k) => shared.removeItem(k),
    }
    const a = written(writeState(inTheWindow, start, testPortfolio(), emptyHistory))

    // Both wrote revision 2 — a counter could not have told them apart …
    expect(revisionInStorage(shared)).toBe(2)
    expect(a).not.toBe(b)
    // … and the storage now holds A's document, not B's.
    expect(storedStamp(shared)).toBe(a)
    expect(restored(shared)!.portfolio).toEqual(testPortfolio())

    // THE PROPERTY: B cannot write on top of A without being told first.
    expect(writeState(shared, b, otherPortfolio(), emptyHistory)).toStrictEqual({
      outcome: 'conflict',
    })
    // A, which did write, is not disturbed by its own bytes.
    expect(writeState(shared, a, testPortfolio(), emptyHistory).outcome).toBe('written')
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
    expect(clearStored(storage)).toBe(true)
    expect(storage.getItem(STATE_KEY)).toBeNull()
    expect(storage.getItem(PREF_KEY)).toBe('on')
  })

  /* ERASING IS A VERDICT TOO. Removing the saved document is how the
     application honours « stop keeping my data »; a caller that assumes the
     removal happened turns that promise into a claim. The three storages below
     are the three ways it does not happen. */
  it('clearStored says false when the bytes are still in there', () => {
    const kept = createMemoryStorage()
    kept.setItem(STATE_KEY, 'whatever was in there')
    const silentlyKeeping: KeyValueStorage = {
      getItem: (key) => kept.getItem(key),
      setItem: (key, value) => kept.setItem(key, value),
      // Returns as if it had obeyed: only a read-back tells this apart from a
      // success, which is exactly why there is one.
      removeItem: () => {},
    }
    expect(clearStored(silentlyKeeping)).toBe(false)
    expect(kept.getItem(STATE_KEY)).toBe('whatever was in there')

    const throwing: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {
        throw new DOMException('access denied', 'SecurityError')
      },
    }
    expect(clearStored(throwing)).toBe(false)

    // A storage that will not be READ cannot prove the key is gone either.
    const unreadable: KeyValueStorage = {
      getItem: () => {
        throw new DOMException('access denied', 'SecurityError')
      },
      setItem: () => {},
      removeItem: () => {},
    }
    expect(clearStored(unreadable)).toBe(false)
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
    let base: StateStamp | null = null
    const record = debounce(
      (p: ReturnType<typeof testPortfolio>) => {
        const outcome = writeState(storage, base, p, emptyHistory)
        if (outcome.outcome === 'written') base = outcome.stamp
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

/**
 * IMPORTABLE IS NOT SAVABLE, AND BOTH ARE SAID. The file ceiling is ~10 M
 * characters; the browser's storage takes about half of that (measured: 5.2 M
 * pass, 5.3 M do not). One figure for both promised what it could not keep —
 * a portfolio could honour the format and never fit in the storage, and only
 * the quota's refusal ever said so, at an unpredictable size.
 */
describe('the two ceilings, named apart', () => {
  /** A portfolio whose serialised form is about `chars` characters. */
  const sized = (chars: number) => {
    const base = testPortfolio()
    return { ...base, review: { ...base.review, title: 'x'.repeat(chars) } }
  }

  it('the storage ceiling is well under the file ceiling', () => {
    expect(MAX_STORED_CHARS).toBeLessThan(MAX_CHARS)
  })

  it('refuses a document past the STORAGE ceiling, deterministically', () => {
    const storage = createMemoryStorage()
    expect(writeState(storage, null, sized(MAX_STORED_CHARS), emptyHistory)).toStrictEqual({
      outcome: 'refused',
    })
    // Refused means refused: nothing half-written, nothing to read back.
    expect(storage.getItem(STATE_KEY)).toBeNull()
    expect(storage.writes).toBe(0)
  })

  it('and that very document is still a legal FILE the parse reads back', () => {
    // The distinction, in one assertion: the format accepts it, the browser
    // will not keep it, and the two answers are given by two ceilings.
    const legal = sized(MAX_STORED_CHARS)
    expect(readPortfolioJson(serializePortfolio(legal)).ok).toBe(true)
  })

  it('a document under the storage ceiling is written whole', () => {
    const storage = createMemoryStorage()
    const outcome = writeState(storage, null, sized(1_000), emptyHistory)
    expect(outcome.outcome).toBe('written')
    expect(restored(storage)!.portfolio).toEqual(sized(1_000))
  })
})
