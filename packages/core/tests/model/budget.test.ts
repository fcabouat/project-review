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
 * WHICH SIDE REFUSES WHAT. The SHAPE of a value is `honorsContract`'s
 * business; the SIZE of the document the value would leave behind is weighed
 * once, after the event is completed, inside `decide`. So every budget
 * assertion below goes through `decide` — the shape gate has nothing to say
 * about length, and the day it pretended to, a ten-million-character title got
 * through it.
 *
 * The capacity budget is a different animal — a count the editor shows and a
 * clamp the slides apply, never a refusal (see the module header). It is
 * pinned at the bottom of this file, on the one function that states it.
 */

import { describe, expect, it } from 'vitest'
import {
  MAX_CHARS,
  MAX_ENTITIES,
  MAX_ROWS,
  TEXT_CAPACITY,
  entityCount,
  overCapacity,
  serializedLength,
  withinMemoryBudget,
} from '../../src/model/budget'
import { decide } from '../../src/commands'
import { apply } from '../../src/events/apply'
import { honorsContract } from '../../src/commands/contract'
import { parsePortfolio } from '../../src/services/parse'
import { writeState, readStored, STATE_KEY } from '../../src/services/persistence'
import { COLORS } from '../../src/model/category'
import type { CustomPalette } from '../../src/model/theme'
import type { Command } from '../../src/commands/index'
import type { Portfolio } from '../../src/model/portfolio'
import type { Project } from '../../src/model/project'
import type { CategoryId, ProjectId } from '../../src/values/ids'
import { isoDate } from '../../src/values/date'
import { emptyHistory } from '../../src/events/history'
import {
  NEW_CATEGORY,
  NEW_PROJECT,
  NEW_SLIDE,
  categoryOf,
  projectOf,
  slideOf,
  testPortfolio,
} from '../fixtures/hand-built-portfolios'
import { COMMAND_SAMPLES } from '../fixtures/command-samples'
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
    // The payload is identical in both cases — and the SHAPE gate says yes to
    // both, because a project is a project. What changes is the state it would
    // JOIN, which is what the budget weighs.
    expect(honorsContract(full, create)).toBe(true)
    expect(decide(last, create)).toBeDefined()
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
    expect(decide(present, merge(1))).toBeDefined()
    expect(decide(present, merge(2))).toBeUndefined()
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
    expect(decide(present, merge)).toBeDefined()
  })

  it('the gate refuses a whole-portfolio replacement the parse would refuse', () => {
    const over = of(MAX_ENTITIES + 1)
    expect(decide(testPortfolio(), { type: 'ReplacePortfolio', portfolio: over })).toBeUndefined()
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
    expect(decide(testPortfolio(), { type: 'ReplacePortfolio', portfolio: heavy })).toBeUndefined()
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

    expect(writeState(storage, null, portfolio, { past, future: [] }).outcome).toBe('written')
    expect(storage.getItem(STATE_KEY)!.length).toBeLessThanOrEqual(MAX_CHARS)
    const back = readStored(storage)
    // The document came back; only the undo steps were the price.
    expect(back.state).toBe('restored')
    expect(back.state === 'restored' && back.portfolio).toEqual(portfolio)
    expect(back.state === 'restored' && back.history).toStrictEqual(emptyHistory)
  })
})

describe('the byte ceiling, weighed on EVERY command — not on a list of the growing ones', () => {
  /** One value past the ceiling on its own: whatever carries it, the document
   * it lands in is beyond what the file format can read back. */
  const HUGE = 'x'.repeat(MAX_CHARS)
  const p = testPortfolio()
  const palette: CustomPalette = {
    label: HUGE,
    colors: Object.fromEntries(COLORS.map((c) => [c, '#112233'])),
  } as CustomPalette

  /**
   * ONE OVERSIZE PAYLOAD PER COMMAND VARIANT, or `null` where the variant
   * carries no new content at all (deletions, moves, a colour out of a closed
   * set). The table is typed over `Command['type']`, so a command cannot join
   * the union without being classified here — which is the whole point: the
   * gate used to carry a list of the commands thought to grow the document,
   * and `ChangeReviewField` was not on it.
   */
  const OVERSIZE: { readonly [T in Command['type']]: Extract<Command, { type: T }> | null } = {
    // The auditor's reproduction, verbatim: a title nobody could store.
    ChangeReviewField: { type: 'ChangeReviewField', field: 'title', after: HUGE },
    ChangeIdentityField: { type: 'ChangeIdentityField', field: 'unit', after: HUGE },
    // Every other setting is a closed value or a size-guarded one; the custom
    // palette's label is free text, and free text is unbounded.
    ChangeSetting: { type: 'ChangeSetting', setting: 'customPalette', after: palette },
    CreateCategory: { type: 'CreateCategory', category: { ...NEW_CATEGORY, name: HUGE }, index: 0 },
    DeleteCategory: null,
    RenameCategory: { type: 'RenameCategory', id: categoryOf(p, 'poste').id, after: HUGE },
    RecolorCategory: null,
    MoveCategory: null,
    CreateProject: { type: 'CreateProject', project: { ...NEW_PROJECT, goal: HUGE }, index: 0 },
    DeleteProject: null,
    MoveProject: null,
    // An id is only required to be non-empty — so it, too, can be a megabyte.
    RenumberProject: {
      type: 'RenumberProject',
      id: projectOf(p, 'P-01').id,
      newId: HUGE as ProjectId,
    },
    ChangeProjectField: {
      type: 'ChangeProjectField',
      id: projectOf(p, 'P-02').id,
      field: 'goal',
      after: HUGE,
    },
    ChangeProjectList: {
      type: 'ChangeProjectList',
      id: projectOf(p, 'P-02').id,
      list: 'done',
      after: [HUGE],
    },
    ChangeProjectMilestones: {
      type: 'ChangeProjectMilestones',
      id: projectOf(p, 'P-02').id,
      after: [{ label: HUGE, date: isoDate('2026-10-01')!, done: false }],
    },
    ChangeProjectDecisions: {
      type: 'ChangeProjectDecisions',
      id: projectOf(p, 'P-02').id,
      after: [{ question: HUGE }],
    },
    CreateFreeSlide: { type: 'CreateFreeSlide', slide: { ...NEW_SLIDE, title: HUGE }, index: 0 },
    DeleteFreeSlide: null,
    ChangeFreeSlide: {
      type: 'ChangeFreeSlide',
      id: slideOf(p, 'opening').id,
      after: { ...slideOf(p, 'opening'), title: HUGE },
    },
    MoveFreeSlide: null,
    ReplacePortfolio: {
      type: 'ReplacePortfolio',
      portfolio: { ...p, review: { ...p.review, title: HUGE } },
    },
    MergeProjects: {
      type: 'MergeProjects',
      projects: [{ ...NEW_PROJECT, goal: HUGE }],
      categories: [],
    },
  }

  it('refuses the oversize payload of every variant that can carry one', () => {
    for (const [type, oversize] of Object.entries(OVERSIZE) as [
      Command['type'],
      Command | null,
    ][]) {
      if (oversize === null) {
        // Nothing new to weigh: the variant still decides, as it always did.
        expect(decide(p, COMMAND_SAMPLES[type].command), type).toBeDefined()
        continue
      }
      // The SHAPE gate says yes — length is not one of the rules it states …
      expect(honorsContract(p, oversize), type).toBe(true)
      // … and the budget is what refuses, for this variant like for any other.
      expect(decide(p, oversize), type).toBeUndefined()
    }
  })

  it('lets the same commands through at an ordinary size', () => {
    // The guard is the SIZE and nothing else: the identical intents, carrying a
    // short value, still become events.
    expect(
      decide(p, { type: 'ChangeReviewField', field: 'title', after: 'Revue 2026' }),
    ).toBeDefined()
    expect(
      decide(p, {
        type: 'RenumberProject',
        id: projectOf(p, 'P-01').id,
        newId: 'P-42' as ProjectId,
      }),
    ).toBeDefined()
  })

  it('never records an event whose state would be beyond the budget', () => {
    // The post-condition itself, over the whole sampled union: whatever
    // `decide` hands back, `writeState` can still put on disk.
    for (const { command } of Object.values(COMMAND_SAMPLES)) {
      const event = decide(p, command)
      if (event !== undefined) expect(withinMemoryBudget(apply(p, event))).toBe(true)
    }
  })
})

describe('the capacity budget — said out loud, never refused', () => {
  it('marks a text beyond its own frame, and only beyond it', () => {
    const fits = 'x'.repeat(TEXT_CAPACITY.reviewTitle)
    expect(overCapacity('reviewTitle', fits)).toBe(false)
    expect(overCapacity('reviewTitle', `${fits}x`)).toBe(true)
    // Each field answers to its OWN figure, not to a shared one: the title's
    // 60 characters overflow the decider column's 40.
    expect(overCapacity('decisionDecider', fits)).toBe(true)
    // An absent value is not an over-long one — an empty field has no counter.
    expect(overCapacity('projectName', undefined)).toBe(false)
    expect(overCapacity('projectName', '')).toBe(false)
  })

  it('refuses nothing: the command carrying an over-capacity text still becomes an event', () => {
    const over = 'x'.repeat(TEXT_CAPACITY.reviewTitle + 1)
    expect(overCapacity('reviewTitle', over)).toBe(true)
    expect(
      decide(testPortfolio(), { type: 'ChangeReviewField', field: 'title', after: over }),
    ).toBeDefined()
  })
})
