/**
 * Pins the stored-event decoder (`src/services/stored-events.ts`) — the door
 * the undo/redo log comes through.
 *
 * The failure it exists to prevent, in full: the browser's storage is ordinary
 * text. A hand-edited `{"type":"FreeSlideChanged"}` used to travel straight
 * through a `typeof e.type === 'string'` check and reach `invert`, which reads
 * `e.after.id` — a `TypeError` on the first Undo, in the middle of the edit
 * loop, on a document that was otherwise perfectly fine.
 *
 * Two directions, and both matter equally: EVERY legitimate event must survive
 * the serialisation round trip (a decoder that refuses real logs silently
 * costs every user their undo stack), and every malformed one must be refused
 * BEFORE `apply`/`invert` ever see it.
 */

import { describe, expect, it } from 'vitest'
import { apply, invert, type DomainEvent } from '../../src/events'
import { emptyHistory } from '../../src/events/history'
import { decodeEvent, decodeHistory } from '../../src/services/stored-events'
import { EVENT_SAMPLES } from '../fixtures/event-samples'
import { testPortfolio } from '../fixtures/hand-built-portfolios'

/** The very trip a stored event makes: through `JSON.stringify` (which DROPS
 * every `undefined` value, keys included) and back. */
const roundTrip = (event: unknown): unknown => JSON.parse(JSON.stringify(event))

const everySample: readonly DomainEvent[] = Object.values(EVENT_SAMPLES).flat()

describe('decodeEvent — every legitimate event survives the round trip', () => {
  it('accepts each of the exhaustive samples, serialised and read back', () => {
    // `EVENT_SAMPLES` is typed over the whole union, so a variant added
    // without a sample does not compile: this loop is exhaustive by
    // construction, not by vigilance.
    for (const sample of everySample) {
      const decoded = decodeEvent(roundTrip(sample))
      expect(
        decoded,
        `refused a legitimate ${sample.type}: ${JSON.stringify(sample)}`,
      ).toBeDefined()
      expect(decoded).toEqual(roundTrip(sample))
    }
  })

  it('covers all twenty-two variants', () => {
    const decoded = new Set(everySample.map((e) => decodeEvent(roundTrip(e))?.type))
    expect(decoded.size).toBe(Object.keys(EVENT_SAMPLES).length)
    expect(decoded.has(undefined)).toBe(false)
  })

  it('a decoded event still applies and inverts to the identity', () => {
    const p = testPortfolio()
    for (const sample of everySample) {
      const event = decodeEvent(roundTrip(sample))!
      expect(apply(apply(p, event), invert(event))).toEqual(p)
    }
  })
})

describe('decodeEvent — the payload-less event that used to crash Undo', () => {
  it('refuses a bare discriminant, for every variant', () => {
    for (const type of Object.keys(EVENT_SAMPLES)) {
      expect(decodeEvent({ type }), `let a bare ${type} through`).toBeUndefined()
    }
  })

  it('refuses the exact F-09 payload, and proves it would have thrown', () => {
    const forged = { type: 'FreeSlideChanged' }
    expect(decodeEvent(forged)).toBeUndefined()
    // What the old shallow check let through, and what it cost: `invert`
    // routes a slide change on the ARRIVAL id, `e.after.id`.
    expect(() => invert(forged as unknown as DomainEvent)).toThrow(TypeError)
  })

  it('refuses anything that is not an object carrying a known type', () => {
    for (const junk of [
      null,
      undefined,
      42,
      'ReviewFieldChanged',
      [],
      {},
      { type: 42 },
      { type: 'NotAnEvent', id: 'x' },
      { type: 'PortfolioReplaced ' },
    ]) {
      expect(decodeEvent(junk)).toBeUndefined()
    }
  })
})

describe('decodeEvent — exact keys, exact types', () => {
  /** A legitimate sample of one variant, already round-tripped. */
  const sampleOf = (type: DomainEvent['type']): Record<string, unknown> =>
    roundTrip(EVENT_SAMPLES[type][0]) as Record<string, unknown>

  it('refuses a key the variant does not own', () => {
    const moved = { ...sampleOf('ProjectMoved'), extra: 1 }
    expect(decodeEvent(moved)).toBeUndefined()
  })

  it('refuses a missing key, variant by variant', () => {
    for (const type of Object.keys(EVENT_SAMPLES) as DomainEvent['type'][]) {
      const sample = sampleOf(type)
      for (const key of Object.keys(sample)) {
        if (key === 'type') continue
        const { [key]: _dropped, ...rest } = sample
        // `before`/`after` may legitimately be absent where the field itself
        // is optional — the probe aggregate is what decides, not a key list.
        const decoded = decodeEvent(rest)
        if (decoded !== undefined) {
          expect(key === 'before' || key === 'after').toBe(true)
        }
      }
    }
  })

  it('refuses an index or a move offset that is not a whole number', () => {
    // `insertAt` clamps a number into range; `"0"` and `NaN` walk past that
    // clamp and silently reorder the collection instead.
    for (const index of ['0', null, 1.5, Number.NaN, {}]) {
      expect(decodeEvent({ ...sampleOf('CategoryCreated'), index })).toBeUndefined()
      expect(decodeEvent({ ...sampleOf('ProjectCreated'), index })).toBeUndefined()
      expect(decodeEvent({ ...sampleOf('FreeSlideCreated'), index })).toBeUndefined()
    }
    for (const to of ['1', Number.NaN, undefined]) {
      expect(decodeEvent({ ...sampleOf('ProjectMoved'), to })).toBeUndefined()
    }
  })

  it('refuses an empty id — the routing key of every id-routed variant', () => {
    for (const type of [
      'CategoryRenamed',
      'CategoryMoved',
      'ProjectMoved',
      'ProjectFieldChanged',
      'FreeSlideChanged',
    ] as const) {
      expect(decodeEvent({ ...sampleOf(type), id: '' })).toBeUndefined()
    }
    expect(decodeEvent({ ...sampleOf('ProjectRenumbered'), newId: '' })).toBeUndefined()
  })

  it('refuses a field name outside its closed vocabulary', () => {
    expect(decodeEvent({ ...sampleOf('ReviewFieldChanged'), field: 'colour' })).toBeUndefined()
    expect(decodeEvent({ ...sampleOf('IdentityFieldChanged'), field: 'motto' })).toBeUndefined()
    expect(decodeEvent({ ...sampleOf('ProjectFieldChanged'), field: 'id' })).toBeUndefined()
    expect(decodeEvent({ ...sampleOf('SettingChanged'), setting: 'gamma' })).toBeUndefined()
    expect(decodeEvent({ ...sampleOf('ProjectListChanged'), list: 'maybe' })).toBeUndefined()
  })

  it('judges a payload by the file contract, not by its JSON type', () => {
    // Each of these is well-typed JSON and a contract violation: a stage
    // outside the enumeration, a progress out of range, a date that is not a
    // calendar day, a colour no palette names.
    const project = { type: 'ProjectFieldChanged', id: 'P-01' }
    expect(
      decodeEvent({ ...project, field: 'stage', before: 'ready', after: 'someday' }),
    ).toBeUndefined()
    expect(decodeEvent({ ...project, field: 'progress', before: 10, after: 140 })).toBeUndefined()
    expect(
      decodeEvent({
        type: 'ReviewFieldChanged',
        field: 'reviewDate',
        before: '2026-01-01',
        after: '2026-02-31',
      }),
    ).toBeUndefined()
    // A REQUIRED field cannot be erased either: an absent `after` would leave
    // a project with no stage, which the file format refuses.
    expect(decodeEvent({ ...project, field: 'stage', before: 'ready' })).toBeUndefined()
    expect(
      decodeEvent({ type: 'CategoryRecolored', id: 'infra', before: 'blue', after: 'chartreuse' }),
    ).toBeUndefined()
    expect(
      decodeEvent({ type: 'SettingChanged', setting: 'recapRows', before: 11, after: 99 }),
    ).toBeUndefined()
    // …and the same shapes, corrected, are accepted.
    expect(
      decodeEvent({ ...project, field: 'stage', before: 'ready', after: 'closed' }),
    ).toBeDefined()
    expect(
      decodeEvent({ type: 'SettingChanged', setting: 'recapRows', before: 11, after: 12 }),
    ).toBeDefined()
  })

  it('refuses a forged portfolio on either side of a replacement', () => {
    expect(
      decodeEvent({ type: 'PortfolioReplaced', before: testPortfolio(), after: { version: 3 } }),
    ).toBeUndefined()
    expect(
      decodeEvent({ type: 'PortfolioReplaced', before: 42, after: testPortfolio() }),
    ).toBeUndefined()
  })

  it('refuses a merge slice that is not positioned content', () => {
    const merged = EVENT_SAMPLES.ProjectsMerged[0]!
    for (const before of [
      {},
      { projects: [], categories: 'nope' },
      { projects: [{ value: { id: 'P-09' }, index: 0 }], categories: [] },
      { projects: [{ value: testPortfolio().projects[0], index: '0' }], categories: [] },
    ]) {
      expect(decodeEvent({ ...(roundTrip(merged) as object), before })).toBeUndefined()
    }
  })
})

describe('decodeHistory — a log is decoded whole or not at all', () => {
  const sound = roundTrip({
    past: [EVENT_SAMPLES.CategoryRenamed[0], EVENT_SAMPLES.ProjectMoved[0]],
    future: [EVENT_SAMPLES.CategoryRecolored[0]],
  })

  it('keeps a log every event of which decodes', () => {
    expect(decodeHistory(sound)).toEqual(sound)
  })

  it('drops the whole log when ONE event fails — a half-replayed stack is worse', () => {
    const past = [...(sound as { past: unknown[] }).past, { type: 'FreeSlideChanged' }]
    expect(decodeHistory({ ...(sound as object), past })).toStrictEqual(emptyHistory)
    expect(
      decodeHistory({ past: [], future: [{ type: 'ProjectMoved', id: 'P-01', from: 0 }] }),
    ).toStrictEqual(emptyHistory)
  })

  it('drops a log that is not two stacks at all', () => {
    for (const junk of [undefined, null, 42, 'log', [], {}, { past: [] }, { past: 1, future: 1 }]) {
      expect(decodeHistory(junk)).toStrictEqual(emptyHistory)
    }
  })
})
