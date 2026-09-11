/**
 * Pins the MEMORY-SAFETY budget (`src/model/budget.ts`) across the three
 * places that used to disagree — and the disagreement WAS the fault: the
 * editor accepted a state, the parse refused it back, and the user found out
 * at the next reload, on a file the application could no longer open.
 *
 * So each ceiling is asserted TWICE, once on the way out (the command gate)
 * and once on the way in (the strict parse), with the same figure: a state the
 * gate accepts is a state the parse takes back, by construction.
 *
 * The capacity budget is NOT here: it is not a refusal (see the module
 * header), it is a count the editor shows and a clamp the slides apply.
 */

import { describe, expect, it } from 'vitest'
import {
  MAX_CHARS,
  MAX_ENTITIES,
  MAX_ROWS,
  entityCount,
  serializedLength,
  withinMemoryBudget,
} from '../../src/model/budget'
import { decide } from '../../src/commands'
import { honorsContract } from '../../src/commands/contract'
import { parsePortfolio } from '../../src/services/parse'
import { writeState, readStored, STATE_KEY } from '../../src/services/persistence'
import type { Portfolio } from '../../src/model/portfolio'
import type { Project } from '../../src/model/project'
import type { CategoryId, ProjectId } from '../../src/values/ids'
import { emptyHistory } from '../../src/events/history'
import { testPortfolio, NEW_PROJECT } from '../fixtures/hand-built-portfolios'
import { rawPortfolio, rawProject } from '../fixtures/raw-portfolios'
import { createMemoryStorage } from '../fixtures/persistence-doubles'

/** `n` contract-valid projects, ids apart. */
const projects = (n: number, goal = 'o'): Project[] =>
  Array.from({ length: n }, (_, i) => ({
    ...NEW_PROJECT,
    id: `X-${i}` as ProjectId,
    categoryId: '' as CategoryId,
    goal,
  }))

/** A portfolio carrying `n` projects. */
const of = (n: number, goal = 'o'): Portfolio => ({
  ...testPortfolio(),
  categories: [],
  projects: projects(n, goal),
  freeSlides: [],
})

describe('the entity ceiling — refused at the edit, never at the reload', () => {
  it('the gate refuses the creation that would cross it, and accepts the one before', () => {
    const full = of(MAX_ENTITIES)
    const last = of(MAX_ENTITIES - 1)
    const create = { type: 'CreateProject', project: NEW_PROJECT, index: 0 } as const

    expect(entityCount(full)).toBe(MAX_ENTITIES)
    // The payload is identical in both cases: what changes is the state it
    // would JOIN, which is exactly what the gate now weighs.
    expect(honorsContract(last, create)).toBe(true)
    expect(honorsContract(full, create)).toBe(false)
    expect(decide(full, create)).toBeUndefined()
  })

  it('the gate refuses the merge that would cross it', () => {
    const present = of(MAX_ENTITIES - 1)
    const merge = (n: number) =>
      ({
        type: 'MergeProjects',
        projects: projects(n).map((x, i) => ({ ...x, id: `M-${i}` as ProjectId })),
        categories: [],
      }) as const
    expect(honorsContract(present, merge(1))).toBe(true)
    expect(honorsContract(present, merge(2))).toBe(false)
  })

  it('a merge that only REPLACES homonyms stays affordable at the ceiling', () => {
    // The merge contract replaces in place: the same ids add nothing, and a
    // budget that counted the payload instead of the projected state would
    // refuse a merge that changes no size at all.
    const present = of(MAX_ENTITIES)
    const merge = {
      type: 'MergeProjects',
      projects: present.projects.map((x) => ({ ...x, name: 'renamed' })),
      categories: [],
    } as const
    expect(honorsContract(present, merge)).toBe(true)
  })

  it('the gate refuses a whole-portfolio replacement the parse would refuse', () => {
    const over = of(MAX_ENTITIES + 1)
    expect(honorsContract(testPortfolio(), { type: 'ReplacePortfolio', portfolio: over })).toBe(
      false,
    )
    // …and the parse says the same thing about the same document.
    expect(parsePortfolio(JSON.parse(JSON.stringify(over))).ok).toBe(false)
  })
})

describe('the nested-collection ceiling', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`)

  it('the parse refuses a narrative list beyond the ceiling', () => {
    const ok = parsePortfolio(rawPortfolio({ projects: [rawProject({ done: rows(MAX_ROWS) })] }))
    expect(ok.ok).toBe(true)
    const over = parsePortfolio(
      rawPortfolio({ projects: [rawProject({ done: rows(MAX_ROWS + 1) })] }),
    )
    expect(over.ok).toBe(false)
    expect(!over.ok && over.errors).toContainEqual({
      path: 'projects[0].done',
      code: 'tooManyEntities',
      params: { max: String(MAX_ROWS), count: String(MAX_ROWS + 1) },
    })
  })

  it('the parse refuses over-long decisions, milestones and free-slide blocks', () => {
    const cases = [
      [
        'projects[0].decisions',
        rawPortfolio({
          projects: [rawProject({ decisions: rows(MAX_ROWS + 1).map((q) => ({ question: q })) })],
        }),
      ],
      [
        'projects[0].milestones',
        rawPortfolio({
          projects: [
            rawProject({
              milestones: rows(MAX_ROWS + 1).map((l) => ({
                label: l,
                date: '2026-01-01',
                done: false,
              })),
            }),
          ],
        }),
      ],
      [
        'freeSlides[0].blocks',
        rawPortfolio({
          freeSlides: [
            {
              id: 'f',
              anchor: { type: 'closing' },
              title: 't',
              blocks: rows(MAX_ROWS + 1).map((l) => [l]),
            },
          ],
        }),
      ],
      [
        'freeSlides[0].blocks[0]',
        rawPortfolio({
          freeSlides: [
            { id: 'f', anchor: { type: 'closing' }, title: 't', blocks: [rows(MAX_ROWS + 1)] },
          ],
        }),
      ],
    ] as const
    for (const [path, raw] of cases) {
      const outcome = parsePortfolio(raw)
      expect(outcome.ok, path).toBe(false)
      expect(!outcome.ok && outcome.errors.map((e) => `${e.path} ${e.code}`)).toContain(
        `${path} tooManyEntities`,
      )
    }
  })

  it('the gate refuses the same collections, on the same figure', () => {
    const p = testPortfolio()
    const id = p.projects[0]!.id
    expect(
      honorsContract(p, { type: 'ChangeProjectList', id, list: 'done', after: rows(MAX_ROWS) }),
    ).toBe(true)
    expect(
      honorsContract(p, { type: 'ChangeProjectList', id, list: 'done', after: rows(MAX_ROWS + 1) }),
    ).toBe(false)
    expect(
      honorsContract(p, {
        type: 'ChangeProjectDecisions',
        id,
        after: rows(MAX_ROWS + 1).map((q) => ({ question: q })),
      }),
    ).toBe(false)
    expect(honorsContract(p, { type: 'ChangeProjectMilestones', id, after: [] })).toBe(true)
  })
})

describe('the serialised ceiling', () => {
  it('withinMemoryBudget measures the form the document travels in', () => {
    const small = testPortfolio()
    expect(withinMemoryBudget(small)).toBe(true)
    expect(serializedLength(small)).toBeLessThan(MAX_CHARS)
    // Indented, not compact: the export is the LARGER of the two shapes, so
    // measuring it bounds the stored envelope too.
    expect(serializedLength(small)).toBe(JSON.stringify(small, null, 2).length)
  })

  it('a state over the byte ceiling is refused by the gate AND by the parse', () => {
    // Few entities, far too many characters: the entity count cannot see this
    // one, which is exactly why the budget carries three ceilings.
    const heavy = of(40, 'x'.repeat(300_000))
    expect(entityCount(heavy)).toBeLessThan(MAX_ENTITIES)
    expect(serializedLength(heavy)).toBeGreaterThan(MAX_CHARS)
    expect(withinMemoryBudget(heavy)).toBe(false)
    expect(honorsContract(testPortfolio(), { type: 'ReplacePortfolio', portfolio: heavy })).toBe(
      false,
    )
  })
})

describe('the write path never stores what the next boot would refuse', () => {
  it('drops the LOG rather than the document when the envelope is too large', () => {
    const storage = createMemoryStorage()
    const portfolio = testPortfolio()
    // A log big enough on its own: replacements carry whole portfolios.
    const fat = { ...portfolio, projects: projects(20, 'y'.repeat(300_000)) }
    const past = Array.from(
      { length: 4 },
      () => ({ type: 'PortfolioReplaced', before: fat, after: fat }) as const,
    )

    expect(writeState(storage, null, portfolio, { past, future: [] })).toStrictEqual({
      outcome: 'written',
      revision: 1,
    })
    expect(storage.getItem(STATE_KEY)!.length).toBeLessThanOrEqual(MAX_CHARS)
    const back = readStored(storage)
    // The document came back; only the undo steps were the price.
    expect(back.state).toBe('restored')
    expect(back.state === 'restored' && back.portfolio).toEqual(portfolio)
    expect(back.state === 'restored' && back.history).toStrictEqual(emptyHistory)
  })
})
