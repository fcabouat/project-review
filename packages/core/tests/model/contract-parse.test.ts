/**
 * THE PROPERTY THAT CLOSES THE CONTRACT'S THREE VOICES.
 *
 * The same rules are stated in three places — the strict parse on bytes coming
 * in (`services/parse/`), the memory mirror on objects already built
 * (`model/contract.ts`, which the command gate and the stored-event decoder
 * both call), and the published schema for outside tooling
 * (`samples/portfolio.schema.json`). Three statements of one rule drift, and
 * the drift always ends the same way: a value the editor accepts and stores is
 * a value the NEXT BOOT refuses, on the recovery screen, over data the person
 * thought was saved.
 *
 * So the two voices that run in this process are pinned to each other by one
 * property, checked below over generated documents:
 *
 *     ∀ p.  validPortfolio(p)  ⇒  readPortfolioJson(serializePortfolio(p)).ok
 *
 * Anything the memory mirror accepts, the file format reads back. It is an
 * IMPLICATION and not an equivalence, deliberately: the parse also NORMALISES
 * (an empty optional string becomes an absence, an empty `fontFaces` becomes
 * none), so a document can come back slightly different — what it may never do
 * is come back refused.
 *
 * Under it, the counter-examples that produced the property, each as its own
 * case: they are the reason it exists, and the reason it is checked on
 * generated documents rather than on the two hand-built ones. The last family
 * is the one the JSON/JavaScript gap opens — values the compiler types and the
 * serialiser cannot write — and the generator carries them too.
 */
import { describe, expect, it } from 'vitest'
import schema from '../../samples/portfolio.schema.json'
import type { Portfolio } from '../../src/model/portfolio'
import type { Command } from '../../src/commands/index'
import { decide, verdict } from '../../src/commands'
import { honorsContract } from '../../src/commands/contract'
import { MAX_ENTITIES, MAX_ROWS } from '../../src/model/budget'
import { validPortfolio } from '../../src/model/contract'
import { readPortfolioJson } from '../../src/services/parse'
import { serializePortfolio } from '../../src/services/portfolio-json'
import { decodeEvent } from '../../src/services/stored-events'
import { intBelow, mulberry32, pick, type Rng } from '../fixtures/seeded-random'
import { NEW_PROJECT, otherPortfolio, testPortfolio } from '../fixtures/hand-built-portfolios'

/* --------------------------- the counter-examples ------------------------ */

/** A candidate built from a good portfolio by one surgical mutation. */
const mutated = (change: (p: Portfolio) => unknown): Portfolio =>
  change(testPortfolio()) as Portfolio

/** A copy of `list` with one HOLE at the end — `length` grown, nothing
 * written. Not an `undefined` element: a hole is what `every` skips (and what
 * a spread would materialise), which is the whole difficulty. */
const withHole = <T>(list: readonly T[]): T[] => {
  const copy = [...list]
  copy.length = list.length + 1
  return copy
}

describe('the counter-examples of the contract', () => {
  it('(1) a key the contract does not own is refused on BOTH sides', () => {
    // It used to pass every runtime validator, become a command, reach the
    // storage — and be refused by the parse at the next boot.
    const intruder = mutated((p) => ({
      ...p,
      projects: [{ ...p.projects[0], colour: 'red' }, ...p.projects.slice(1)],
    }))
    expect(validPortfolio(intruder)).toBe(false)
    expect(readPortfolioJson(serializePortfolio(intruder)).ok).toBe(false)

    // And the same at the root, at the review, and inside the settings.
    expect(validPortfolio(mutated((p) => ({ ...p, extra: 1 })))).toBe(false)
    expect(validPortfolio(mutated((p) => ({ ...p, review: { ...p.review, extra: 1 } })))).toBe(
      false,
    )
    expect(
      validPortfolio(
        mutated((p) => ({
          ...p,
          settings: { ...p.settings, theme: { ...p.settings.theme, extra: 1 } },
        })),
      ),
    ).toBe(false)
  })

  it('(1 bis) a key whose value is undefined is an ABSENT key, and still passes', () => {
    // `JSON.stringify` drops it, so the serialised form the parse reads does
    // not carry it — refusing it in memory would refuse a document the file
    // format accepts, which is the opposite error.
    const withHoles = mutated((p) => ({
      ...p,
      review: { ...p.review, subtitle: undefined },
      settings: { ...p.settings, theme: { ...p.settings.theme, customPalette: undefined } },
    }))
    expect(validPortfolio(withHoles)).toBe(true)
    expect(readPortfolioJson(serializePortfolio(withHoles)).ok).toBe(true)
  })

  it('(2) the full CSS weight range is accepted by both', () => {
    const light = mutated((p) => ({
      ...p,
      settings: {
        ...p.settings,
        theme: {
          ...p.settings.theme,
          fontFaces: [
            {
              family: 'Atelier',
              weight: '300',
              style: 'normal',
              dataUri: 'data:font/woff2;base64,AAAA',
            },
          ],
        },
      },
    }))
    expect(validPortfolio(light)).toBe(true)
    expect(readPortfolioJson(serializePortfolio(light)).ok).toBe(true)
    const SCHEMA_WEIGHT = new RegExp(
      schema.properties.settings.properties.theme.properties.fontFaces.items.properties.weight
        .pattern,
    )
    expect(SCHEMA_WEIGHT.test('300')).toBe(true)
    expect(SCHEMA_WEIGHT.test('400')).toBe(true)
    expect(SCHEMA_WEIGHT.test('800')).toBe(true)
    expect(SCHEMA_WEIGHT.test('900')).toBe(true)
    expect(SCHEMA_WEIGHT.test('400 800')).toBe(true)
  })

  it('(3) the three list events weigh the row ceiling, not only the elements', () => {
    const overflowing = Array.from({ length: MAX_ROWS + 1 }, () => 'a line')
    expect(
      decodeEvent({
        type: 'ProjectListChanged',
        id: 'P-01',
        list: 'done',
        before: [],
        after: overflowing,
      }),
    ).toBeUndefined()
    expect(
      decodeEvent({
        type: 'ProjectMilestonesChanged',
        id: 'P-01',
        before: [],
        after: Array.from({ length: MAX_ROWS + 1 }, () => ({
          label: 'M',
          date: '2026-01-01',
          done: false,
        })),
      }),
    ).toBeUndefined()
    expect(
      decodeEvent({
        type: 'ProjectDecisionsChanged',
        id: 'P-01',
        before: [],
        after: Array.from({ length: MAX_ROWS + 1 }, () => ({ question: 'Q' })),
      }),
    ).toBeUndefined()

    // A list that FITS still decodes: the bound is the ceiling, not a ban.
    expect(
      decodeEvent({
        type: 'ProjectListChanged',
        id: 'P-01',
        list: 'done',
        before: [],
        after: ['one line'],
      }),
    ).toBeDefined()
  })

  it('(4) validPortfolio counts the entities and measures the text', () => {
    const base = testPortfolio()
    const crowd = {
      ...base,
      projects: Array.from({ length: MAX_ENTITIES + 1 }, (_, i) => ({
        ...base.projects[0]!,
        id: `P-${i}`,
      })),
    } as unknown as Portfolio
    expect(validPortfolio(crowd)).toBe(false)
    expect(readPortfolioJson(serializePortfolio(crowd)).ok).toBe(false)

    const heavy = mutated((p) => ({ ...p, review: { ...p.review, title: 'x'.repeat(10_000_001) } }))
    expect(validPortfolio(heavy)).toBe(false)
    expect(readPortfolioJson(serializePortfolio(heavy)).ok).toBe(false)
  })
})

/* -------------- the values JavaScript holds and JSON cannot write --------- */

/**
 * The gap the runtime rules had left open: a value TypeScript types, the
 * element-wise checks accept, and `JSON.stringify` writes as something else —
 * `null`. Every one of them is the same failure, and it always lands at the
 * next boot: the editor accepted the edit, the storage took it, and the parse
 * refused what came back.
 */
describe('a hole in a collection, and a position that is not a number', () => {
  const p = testPortfolio()

  it('a SPARSE collection is refused in memory, exactly as the parse refuses its null', () => {
    // `every` skips holes: the rule was never shown the missing element, so it
    // said yes — and `[null]` is what the file then carried.
    expect(JSON.stringify(Array<string>(1))).toBe('[null]')
    const sparse = mutated((first) => ({
      ...first,
      projects: [{ ...first.projects[0], done: Array<string>(1) }, ...first.projects.slice(1)],
    }))
    expect(validPortfolio(sparse)).toBe(false)
    expect(readPortfolioJson(serializePortfolio(sparse)).ok).toBe(false)

    // And the command that would have written it is refused at the gate, which
    // is the only place the refusal costs nothing.
    const id = p.projects[0]!.id
    expect(
      honorsContract(p, { type: 'ChangeProjectList', id, list: 'done', after: Array<string>(1) }),
    ).toBe(false)
    // The holes of a nested collection count too — a decision list, a block.
    expect(honorsContract(p, { type: 'ChangeProjectDecisions', id, after: Array(1) })).toBe(false)
  })

  it('a move to NaN is refused at the command, not discovered at the next reload', () => {
    const id = p.projects[0]!.id
    const forged = { type: 'MoveProject', id, to: Number.NaN } as unknown as Command
    expect(verdict(p, forged)).toEqual({ ok: false, refusal: 'offContract' })
    expect(decide(p, forged)).toBeUndefined()

    // Why it has to be refused THERE: the event it completed reordered the
    // projects and then serialised its own position to `null`, so the order had
    // changed and the log that could undo it was dropped at the next read.
    const moved = { type: 'ProjectMoved', id, from: 0, to: Number.NaN }
    const stored: unknown = JSON.parse(JSON.stringify(moved))
    expect(stored).toEqual({ type: 'ProjectMoved', id, from: 0, to: null })
    expect(decodeEvent(stored)).toBeUndefined()
    // ±Infinity travels the same way, and an index is a position too.
    expect(
      decide(p, { type: 'MoveCategory', id: p.categories[0]!.id, to: Number.POSITIVE_INFINITY }),
    ).toBeUndefined()
    expect(
      decide(p, { type: 'CreateProject', project: NEW_PROJECT, index: Number.NaN }),
    ).toBeUndefined()
  })
})

/* ------------------------------ the property ----------------------------- */

/**
 * One candidate document — a good portfolio with between zero and three
 * mutations applied to it. The mutations are the SHAPES the contract has
 * opinions about: unknown keys, absent required values, values off their
 * enumeration, ids that clash or are empty, collections past their ceiling —
 * and, because a dense JSON tree is not the only thing a running program can
 * hold, the values JAVASCRIPT has and JSON has not: `NaN`, `±Infinity`, `-0`,
 * arrays with holes. Most candidates are therefore invalid, which is the
 * point: the property says something about every one the mirror ACCEPTS, so
 * the generator must produce both kinds.
 */
const MUTATIONS: readonly ((p: Portfolio, rng: Rng) => unknown)[] = [
  (p) => ({ ...p, intruder: 1 }),
  (p) => ({ ...p, version: 2 }),
  (p) => ({ ...p, review: { ...p.review, title: undefined } }),
  (p) => ({ ...p, review: { ...p.review, title: '' } }),
  (p) => ({ ...p, review: { ...p.review, reviewDate: '2026-02-30' } }),
  (p) => ({ ...p, review: { ...p.review, subtitle: undefined } }),
  (p) => ({ ...p, review: { ...p.review, note: 'x' } }),
  (p) => ({ ...p, settings: { ...p.settings, language: 'de' } }),
  (p) => ({ ...p, settings: { ...p.settings, recapRows: 99 } }),
  (p) => ({ ...p, settings: { ...p.settings, identity: { ...p.settings.identity, org: '' } } }),
  (p) => ({ ...p, settings: { ...p.settings, identity: { ...p.settings.identity, org: 7 } } }),
  (p) => ({
    ...p,
    settings: { ...p.settings, theme: { ...p.settings.theme, font: 'Bad<Font>' } },
  }),
  (p) => ({
    ...p,
    settings: {
      ...p.settings,
      theme: {
        ...p.settings.theme,
        fontFaces: [
          {
            family: 'Atelier',
            weight: '300',
            style: 'normal',
            dataUri: 'data:font/woff2;base64,AAAA',
          },
        ],
      },
    },
  }),
  (p) => ({
    ...p,
    settings: {
      ...p.settings,
      theme: {
        ...p.settings.theme,
        fontFaces: [
          {
            family: 'Atelier',
            weight: '400 700',
            style: 'italic',
            dataUri: 'data:font/woff2;base64,AAAA',
          },
        ],
      },
    },
  }),
  (p) => ({ ...p, settings: { ...p.settings, show: { ...p.settings.show, recap: 'yes' } } }),
  (p) => ({ ...p, categories: [...p.categories, { ...p.categories[0] }] }),
  (p) => ({ ...p, categories: [...p.categories, { id: '', name: 'x', color: 'blue' }] }),
  (p) => ({ ...p, categories: [...p.categories, { id: 'c9', name: 'x', color: 'chartreuse' }] }),
  (p, rng) => ({
    ...p,
    projects: p.projects.map((x, i) =>
      i === intBelow(rng, p.projects.length) ? { ...x, q: 1 } : x,
    ),
  }),
  (p) => ({ ...p, projects: p.projects.map((x) => ({ ...x, stage: 'unknown' })) }),
  (p) => ({ ...p, projects: p.projects.map((x) => ({ ...x, progress: 101 })) }),
  (p) => ({ ...p, projects: p.projects.map((x) => ({ ...x, goal: undefined })) }),
  (p) => ({
    ...p,
    projects: p.projects.map((x) => ({
      ...x,
      done: Array.from({ length: MAX_ROWS + 1 }, () => 'l'),
    })),
  }),
  (p) => ({
    ...p,
    projects: p.projects.map((x) => ({
      ...x,
      decisions: [{ question: 'q', taken: { text: 'a' } }],
    })),
  }),
  (p) => ({
    ...p,
    projects: p.projects.map((x) => ({
      ...x,
      milestones: [{ label: 'm', date: '2026-01-01', done: false, extra: 1 }],
    })),
  }),
  (p) => ({ ...p, freeSlides: p.freeSlides.map((s) => ({ ...s, blocks: [] })) }),
  (p) => ({
    ...p,
    freeSlides: p.freeSlides.map((s) => ({
      ...s,
      anchor: { type: 'beforeCategory', categoryId: '' },
    })),
  }),
  (p) => ({
    ...p,
    freeSlides: p.freeSlides.map((s) => ({ ...s, anchor: { type: 'opening', categoryId: 'c1' } })),
  }),
  (p) => ({ ...p, freeSlides: [...p.freeSlides, ...p.freeSlides] }),
  /* ---- the values JavaScript writes and JSON does not (see above) ---- */
  (p) => ({ ...p, projects: p.projects.map((x) => ({ ...x, progress: Number.NaN })) }),
  (p) => ({ ...p, projects: p.projects.map((x) => ({ ...x, progress: -0 })) }),
  (p) => ({
    ...p,
    settings: { ...p.settings, recapRows: Number.POSITIVE_INFINITY },
  }),
  (p) => ({ ...p, projects: p.projects.map((x) => ({ ...x, done: withHole(x.done) })) }),
  (p) => ({
    ...p,
    projects: p.projects.map((x) => ({ ...x, milestones: withHole(x.milestones) })),
  }),
  (p) => ({ ...p, freeSlides: p.freeSlides.map((s) => ({ ...s, blocks: withHole(s.blocks) })) }),
  (p) => ({ ...p, projects: withHole(p.projects) }),
]

const candidate = (rng: Rng): Portfolio => {
  let p: unknown = pick(rng, [testPortfolio, otherPortfolio])()
  for (let i = intBelow(rng, 4); i > 0; i -= 1) {
    p = pick(rng, MUTATIONS)(p as Portfolio, rng)
  }
  return p as Portfolio
}

describe('validPortfolio ⇒ the serialisation re-passes the parse', () => {
  it('holds over a thousand generated documents, accepted and refused alike', () => {
    const rng = mulberry32(20260912)
    let accepted = 0
    for (let i = 0; i < 1_000; i += 1) {
      const p = candidate(rng)
      if (!validPortfolio(p)) continue
      accepted += 1
      const outcome = readPortfolioJson(serializePortfolio(p))
      // The whole point: not "the same document", but "still a document".
      expect(outcome.ok, JSON.stringify(p).slice(0, 400)).toBe(true)
    }
    // A property nothing satisfies proves nothing: the generator must actually
    // produce documents the mirror accepts.
    expect(accepted).toBeGreaterThan(100)
  })

  it('and the generator really does produce refusals too', () => {
    const rng = mulberry32(7)
    let refused = 0
    for (let i = 0; i < 500; i += 1) if (!validPortfolio(candidate(rng))) refused += 1
    expect(refused).toBeGreaterThan(100)
  })
})
