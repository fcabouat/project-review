/**
 * Pins the bounded event register (`src/events/history.ts`) alone — no
 * portfolio, no apply/invert: synthetic events are enough, since the register
 * only stores and hands them back.
 */

import { describe, expect, it } from 'vitest'
import type { DomainEvent } from '../../src/events'
import {
  HISTORY_LIMIT,
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
