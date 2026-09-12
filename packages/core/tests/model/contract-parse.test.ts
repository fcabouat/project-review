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
 * Under it, the four counter-examples the third audit produced, each as its own
 * case: they are the reason the property exists, and the reason it is checked
 * on generated documents rather than on the two hand-built ones.
 */
import { describe, expect, it } from 'vitest'
import type { Portfolio } from '../../src/model/portfolio'
import { MAX_ENTITIES, MAX_ROWS } from '../../src/model/budget'
import { validPortfolio } from '../../src/model/contract'
import { readPortfolioJson } from '../../src/services/parse'
import { serializePortfolio } from '../../src/services/portfolio-json'
import { decodeEvent } from '../../src/services/stored-events'
import { intBelow, mulberry32, pick, type Rng } from '../fixtures/seeded-random'
import { otherPortfolio, testPortfolio } from '../fixtures/hand-built-portfolios'

/* --------------------------- the counter-examples ------------------------ */

/** A candidate built from a good portfolio by one surgical mutation. */
const mutated = (change: (p: Portfolio) => unknown): Portfolio =>
  change(testPortfolio()) as Portfolio

describe('the four counter-examples of the third audit', () => {
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

  it('(2) the weight 300 the schema used to accept is refused by both', () => {
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
    expect(validPortfolio(light)).toBe(false)
    expect(readPortfolioJson(serializePortfolio(light)).ok).toBe(false)
    // The schema now states the very same range, so outside tooling refuses it
    // too: `^(?:[4-7][0-9]{2}|800)(?: (?:[4-7][0-9]{2}|800))?$`.
    const SCHEMA_WEIGHT = /^(?:[4-7][0-9]{2}|800)(?: (?:[4-7][0-9]{2}|800))?$/
    expect(SCHEMA_WEIGHT.test('300')).toBe(false)
    expect(SCHEMA_WEIGHT.test('400')).toBe(true)
    expect(SCHEMA_WEIGHT.test('800')).toBe(true)
    expect(SCHEMA_WEIGHT.test('900')).toBe(false)
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

/* ------------------------------ the property ----------------------------- */

/**
 * One candidate document — a good portfolio with between zero and three
 * mutations applied to it. The mutations are the SHAPES the contract has
 * opinions about: unknown keys, absent required values, values off their
 * enumeration, ids that clash or are empty, collections past their ceiling.
 * Most candidates are therefore invalid, which is the point: the property says
 * something about every one the mirror ACCEPTS, so the generator must produce
 * both kinds.
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
