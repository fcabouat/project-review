/**
 * Pins the bounded event register (`src/events/history.ts`) alone — no
 * portfolio, no apply/invert: synthetic events are enough, since the register
 * only stores and hands them back.
 */

import { describe, expect, it } from 'vitest'
import type { DomainEvent } from '../../src/events'
import {
  HISTORY_LIMIT,
  HISTORY_MAX_CHARS,
  emptyHistory,
  hydrate,
  record,
  stepBack,
  stepForward,
  type History,
} from '../../src/events/history'

const event = (i: number): DomainEvent => ({
  type: 'ReviewFieldChanged',
  field: 'title',
  before: `t${i}`,
  after: `t${i + 1}`,
})

describe('record', () => {
  it('appends to the past and clears the future (a new edit is a new branch)', () => {
    const h = record({ past: [event(0)], future: [event(9)] }, event(1))
    expect(h.past).toEqual([event(0), event(1)])
    expect(h.future).toEqual([])
  })

  it(`drops the OLDEST event at the record that would exceed ${HISTORY_LIMIT}, silently`, () => {
    let h: History = emptyHistory
    for (let i = 0; i < HISTORY_LIMIT; i += 1) h = record(h, event(i))
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toEqual(event(0))

    h = record(h, event(HISTORY_LIMIT))
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toEqual(event(1))
    expect(h.past.at(-1)).toEqual(event(HISTORY_LIMIT))
  })
})

describe('stepBack / stepForward — the cursor', () => {
  it('hands the most recent event over and moves it to the head of the future', () => {
    const h: History = { past: [event(0), event(1)], future: [] }
    const step = stepBack(h)!
    expect(step.event).toEqual(event(1))
    expect(step.history.past).toEqual([event(0)])
    expect(step.history.future).toEqual([event(1)])
  })

  it('keeps the chronological order of the future (next to redo first)', () => {
    let h: History = { past: [event(0), event(1)], future: [] }
    h = stepBack(h)!.history
    h = stepBack(h)!.history
    expect(h.past).toEqual([])
    expect(h.future).toEqual([event(0), event(1)])
  })

  it('round-trips: back then forward restores the trail, event for event', () => {
    let h: History = emptyHistory
    for (let i = 0; i < 50; i += 1) h = record(h, event(i))
    const full = h

    const undone: DomainEvent[] = []
    for (let i = 0; i < 50; i += 1) {
      const step = stepBack(h)!
      undone.push(step.event)
      h = step.history
    }
    expect(h.past).toHaveLength(0)
    expect(h.future).toHaveLength(50)

    const redone: DomainEvent[] = []
    for (let i = 0; i < 50; i += 1) {
      const step = stepForward(h)!
      redone.push(step.event)
      h = step.history
    }
    expect(h).toEqual(full)
    // Forward replays in the exact reverse order of the backward walk.
    expect(redone).toEqual([...undone].reverse())
  })

  it('returns undefined on an empty side — nothing to hand over', () => {
    expect(stepBack(emptyHistory)).toBeUndefined()
    expect(stepForward(emptyHistory)).toBeUndefined()
  })

  it('stepForward re-applies the cap: a full past cannot overflow', () => {
    const past = Array.from({ length: HISTORY_LIMIT }, (_, i) => event(i))
    const h: History = { past, future: [event(999)] }
    const step = stepForward(h)!
    expect(step.history.past).toHaveLength(HISTORY_LIMIT)
    expect(step.history.past.at(-1)).toEqual(event(999))
    expect(step.history.future).toEqual([])
  })
})

describe('hydrate', () => {
  it('restores a stored trail as-is when it fits', () => {
    const trail: History = { past: [event(0)], future: [event(1)] }
    expect(hydrate(trail)).toEqual(trail)
  })

  it('re-caps an oversized past to its most recent events', () => {
    const past = Array.from({ length: HISTORY_LIMIT + 3 }, (_, i) => event(i))
    const h = hydrate({ past, future: [] })
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toEqual(event(3))
  })
})

/**
 * THE SECOND BOUND, AND THE REASON THERE IS ONE. Five hundred field edits
 * weigh a few kilobytes; five hundred whole-portfolio replacements carry a
 * thousand documents. Bounded by number alone the trail outweighed the
 * document it belongs to, and the only thing that ever noticed was the save,
 * which then dropped the WHOLE log at once.
 */
describe('the weight bound', () => {
  /** A replacement taking `share` of the whole budget — one `PortfolioReplaced`
   * carries TWO documents, so each side gets half of what it is asked for. */
  const heavy = (share: number, tag: string): DomainEvent => {
    const side = tag.repeat(Math.floor((HISTORY_MAX_CHARS * share) / 2) - 40)
    return {
      type: 'PortfolioReplaced',
      before: { version: 4, review: { title: side } },
      after: { version: 4, review: { title: side } },
    } as unknown as DomainEvent
  }

  it('evicts by WEIGHT, so a big replacement pushes out more than a small edit', () => {
    let h: History = emptyHistory
    // Two two-fifths replacements fit side by side; the third evicts the first.
    h = record(h, heavy(0.4, 'a'))
    h = record(h, heavy(0.4, 'b'))
    expect(h.past).toHaveLength(2)
    h = record(h, heavy(0.4, 'c'))
    expect(h.past).toHaveLength(2)
    expect(h.past[0]).toStrictEqual(heavy(0.4, 'b'))

    // The same count of ORDINARY edits costs nothing and is all kept.
    let light: History = emptyHistory
    for (let i = 0; i < 100; i += 1) light = record(light, event(i))
    expect(light.past).toHaveLength(100)
  })

  it('never drops the newest step, however heavy it alone is', () => {
    // A step missing from the head would leave `undo` inverting the step
    // before it against a document that step never described.
    const monstrous = heavy(4, 'z')
    const h = record({ past: [event(0), event(1)], future: [] }, monstrous)
    expect(h.past).toStrictEqual([monstrous])
  })

  it('weighs a whole event: strings exactly, everything else flat', () => {
    // Booleans, numbers, `null` and an ABSENT optional key all travel through
    // the walk; none of them is what decides a trail.
    const mixed = {
      type: 'ProjectFieldChanged',
      id: 'P-01',
      field: 'progress',
      before: undefined,
      after: 42,
    } as unknown as DomainEvent
    const nested = {
      type: 'ProjectMilestonesChanged',
      id: 'P-01',
      before: [],
      after: [{ label: 'L', date: '2026-01-01', done: true, display: null }],
    } as unknown as DomainEvent
    let h: History = emptyHistory
    h = record(h, mixed)
    h = record(h, nested)
    expect(h.past).toStrictEqual([mixed, nested])
  })

  it('applies to hydration and to redo, not only to the record', () => {
    const stored: History = {
      past: [heavy(0.4, 'a'), heavy(0.4, 'b'), heavy(0.4, 'c')],
      future: [],
    }
    expect(hydrate(stored).past).toHaveLength(2)

    const forward = stepForward({
      past: [heavy(0.4, 'a'), heavy(0.4, 'b')],
      future: [heavy(0.4, 'c')],
    })
    expect(forward?.history.past).toHaveLength(2)
  })
})
