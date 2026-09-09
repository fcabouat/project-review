/**
 * Pins the strict parse (`src/services/parse/`) — the import contract is
 * closed: a violation refuses the whole file with the EXHAUSTIVE error list,
 * nothing is ever repaired, and `samples/portfolio.schema.json` states the same
 * rules for outside tooling (last block: both gates agree on the samples).
 */
import { describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import rawFr from '../../../samples/sample-portfolio.fr.json'
import rawEn from '../../../samples/sample-portfolio.en.json'
import schema from '../../../samples/portfolio.schema.json'
import {
  IMPORT_MAX_CHARS,
  PARSE_ERROR_CODES,
  parsePortfolio,
  readPortfolioJson,
  type ParseResult,
} from '../../../src/services/parse/index'
import { deck } from '../../../src/projections/index'
import { rawPortfolio, rawProject } from '../../fixtures/raw-portfolios'

/** `path code` fingerprints of a refusal — the shape most assertions read. */
function faults(r: ParseResult): readonly string[] {
  if (r.ok) throw new Error('expected a refusal')
  return r.errors.map((e) => `${e.path} ${e.code}`)
}

describe('acceptance — a contract-valid file parses whole', () => {
  it('accepts the minimal valid portfolio and derives a deck', () => {
    const r = parsePortfolio(rawPortfolio())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.portfolio.version).toBe(3)
    expect(deck(r.portfolio).length).toBeGreaterThanOrEqual(2)
  })

  it('defaults the optional settings: language fr, theme flat/material/Roboto', () => {
    const r = parsePortfolio(rawPortfolio())
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    expect(r.portfolio.settings.language).toBe('fr')
    expect(r.portfolio.settings.theme).toEqual({
      style: 'flat',
      palette: 'material',
      font: 'Roboto',
    })
  })

  it('accepts "" as the unassigned categoryId and preserves element order', () => {
    const r = parsePortfolio(
      rawPortfolio({
        categories: [
          { id: 'b', name: 'B', color: 'teal' },
          { id: 'a', name: 'A', color: 'blue' },
        ],
        projects: [rawProject({ id: 'P-02', categoryId: '' }), rawProject({ id: 'P-01' })],
      }),
    )
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    expect(r.portfolio.categories.map((c) => c.id)).toEqual(['b', 'a'])
    expect(r.portfolio.projects.map((p) => p.id)).toEqual(['P-02', 'P-01'])
    expect(r.portfolio.projects[0]!.categoryId).toBe('')
  })

  it('normalises an empty optional text to absence', () => {
    const r = parsePortfolio(
      rawPortfolio({
        review: { title: 't', reviewDate: '2026-01-01', subtitle: '' },
        projects: [rawProject({ lead: '' })],
      }),
    )
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    expect(r.portfolio.review.subtitle).toBeUndefined()
    expect(r.portfolio.projects[0]!.lead).toBeUndefined()
    // An absent value never reaches the export: JSON.stringify drops it.
    expect(JSON.stringify(r.portfolio)).not.toContain('subtitle')
  })
})

describe('refusal — structure', () => {
  it('refuses a non-object root outright', () => {
    for (const bad of [null, 'not an object', 42, ['x']]) {
      expect(parsePortfolio(bad)).toEqual({
        ok: false,
        errors: [{ path: '', code: 'notAnObject' }],
      })
    }
  })

  it('an empty object is refused with every missing root key listed', () => {
    const r = parsePortfolio({})
    expect(faults(r)).toEqual([
      'version missingKey',
      'review missingKey',
      'settings missingKey',
      'categories missingKey',
      'projects missingKey',
      'freeSlides missingKey',
    ])
  })

  it('refuses version ≠ 3', () => {
    expect(faults(parsePortfolio(rawPortfolio({ version: 2 })))).toEqual(['version invalidVersion'])
  })

  it('refuses an unknown key, at the root and nested', () => {
    expect(faults(parsePortfolio(rawPortfolio({ backgroundColor: '#FF0000' })))).toEqual([
      'backgroundColor unknownKey',
    ])
    expect(
      faults(parsePortfolio(rawPortfolio({ projects: [rawProject({ colour: 'red' })] }))),
    ).toEqual(['projects[0].colour unknownKey'])
  })

  it('a file whose top-level keys are not the schema’s is refused — no repair, no guessing', () => {
    const r = parsePortfolio({ version: 2, agenda: { heading: 't', day: '2026-01-01' } })
    expect(r.ok).toBe(false)
    expect(faults(r)).toContain('agenda unknownKey')
    expect(faults(r)).toContain('review missingKey')
    expect(faults(r)).toContain('version invalidVersion')
  })

  it('refuses wrong JSON types where the contract fixes them', () => {
    const r = parsePortfolio(
      rawPortfolio({
        review: { title: 42, reviewDate: '2026-01-01' },
        categories: ['x'],
        projects: [rawProject({ onHold: 'yes', done: ['a', 7] })],
      }),
    )
    expect(faults(r)).toEqual([
      'review.title wrongType',
      'categories[0] wrongType',
      'projects[0].onHold wrongType',
      'projects[0].done[1] wrongType',
    ])
  })

  it('a project with EVERY field mistyped reports every fault, each at its path', () => {
    // One row, 25 faults: the reader never stops at the first one, and every
    // field family (id, scalars, enums, dates, lists, rows) speaks with its
    // own code — the exhaustive wrongType census of the project row.
    const r = parsePortfolio(
      rawPortfolio({
        projects: [
          {
            id: 7,
            name: 1,
            categoryId: [],
            stage: 0,
            onHold: 'yes',
            goal: {},
            done: 'x',
            ongoing: 3,
            next: {},
            decisions: 'none',
            milestones: {},
            sheet: 4,
            priority: [],
            health: 9,
            progress: 'high',
            lead: 5,
            sponsor: [],
            scope: {},
            budget: 0,
            start: 6,
            targetEnd: [],
            actualEnd: {},
            risks: 1,
            updatedOn: false,
            author: [],
          },
        ],
      }),
    )
    expect(faults(r)).toEqual([
      'projects[0].categoryId wrongType',
      'projects[0].progress invalidProgress',
      'projects[0].id wrongType',
      'projects[0].name wrongType',
      'projects[0].priority invalidEnum',
      'projects[0].stage invalidEnum',
      'projects[0].onHold wrongType',
      'projects[0].health invalidEnum',
      'projects[0].lead wrongType',
      'projects[0].sponsor wrongType',
      'projects[0].scope wrongType',
      'projects[0].goal wrongType',
      'projects[0].budget wrongType',
      'projects[0].start wrongType',
      'projects[0].targetEnd wrongType',
      'projects[0].actualEnd wrongType',
      'projects[0].done wrongType',
      'projects[0].ongoing wrongType',
      'projects[0].next wrongType',
      'projects[0].risks wrongType',
      'projects[0].decisions wrongType',
      'projects[0].milestones wrongType',
      'projects[0].sheet invalidEnum',
      'projects[0].updatedOn wrongType',
      'projects[0].author wrongType',
    ])
  })

  it('refuses a non-array projects collection at the root', () => {
    expect(faults(parsePortfolio(rawPortfolio({ projects: 'x' })))).toEqual(['projects wrongType'])
  })
})

describe('refusal — values', () => {
  it('refuses every non-calendar date, previousReviewDate included', () => {
    const r = parsePortfolio(
      rawPortfolio({
        review: { title: 't', reviewDate: '2026-02-29', previousReviewDate: 'juin 2026' },
        projects: [rawProject({ start: '01/09/2026' })],
      }),
    )
    expect(faults(r)).toEqual([
      'review.reviewDate invalidDate',
      'review.previousReviewDate invalidDate',
      'projects[0].start invalidDate',
    ])
  })

  it('refuses unknown enumeration members, naming the allowed set', () => {
    const r = parsePortfolio(
      rawPortfolio({
        settings: {
          identity: { org: 'a', unit: 'b' },
          language: 'de',
          theme: { palette: 'bootstrap', style: 'baroque' },
          show: { healthDashboard: true, recap: true, archives: true, decisions: true },
          recapRows: 11,
        },
        categories: [{ id: 'c1', name: 'C', color: 'fuchsia' }],
        projects: [
          rawProject({ stage: 'terminé', health: 'bof', priority: 'P9', sheet: 'toujours' }),
        ],
      }),
    )
    expect(faults(r)).toEqual([
      'settings.language invalidEnum',
      'settings.theme.style invalidEnum',
      'settings.theme.palette invalidEnum',
      'categories[0].color invalidEnum',
      'projects[0].priority invalidEnum',
      'projects[0].stage invalidEnum',
      'projects[0].health invalidEnum',
      'projects[0].sheet invalidEnum',
    ])
    if (!r.ok) {
      expect(r.errors[0]!.params).toEqual({ value: 'de', allowed: 'fr | en' })
    }
  })

  it('refuses a non-integer or out-of-range progress — no clamping', () => {
    for (const bad of [41.6, -3, 140, 'high']) {
      const r = parsePortfolio(rawPortfolio({ projects: [rawProject({ progress: bad })] }))
      expect(faults(r)).toEqual(['projects[0].progress invalidProgress'])
    }
  })

  it('refuses recapRows outside 6–16 or non-integer', () => {
    for (const bad of [5, 17, 11.5, '11']) {
      const r = parsePortfolio(
        rawPortfolio({
          settings: {
            identity: { org: 'a', unit: 'b' },
            show: { healthDashboard: true, recap: true, archives: true, decisions: true },
            recapRows: bad,
          },
        }),
      )
      expect(faults(r)).toEqual(['settings.recapRows invalidRecapRows'])
    }
  })

  it('refuses an empty or duplicate id — no dedup suffix', () => {
    const r = parsePortfolio(
      rawPortfolio({
        projects: [rawProject({ id: 'P-01' }), rawProject({ id: 'P-01' }), rawProject({ id: '' })],
      }),
    )
    expect(faults(r)).toEqual(['projects[1].id duplicateId', 'projects[2].id emptyId'])
  })

  it('refuses a font name outside the letters/digits charset — it lands in the exported <style>', () => {
    const settings = (font: string) => ({
      identity: { org: 'a', unit: 'b' },
      theme: { font },
      show: { healthDashboard: true, recap: true, archives: true, decisions: true },
      recapRows: 11,
    })
    // The PoC payload: a name that would close the RAWTEXT <style> of the
    // standalone export. Refused at the door, whole file.
    expect(
      faults(parsePortfolio(rawPortfolio({ settings: settings('X</style><script>') }))),
    ).toEqual(['settings.theme.font invalidFont'])
    expect(faults(parsePortfolio(rawPortfolio({ settings: settings('A'.repeat(65)) })))).toEqual([
      'settings.theme.font invalidFont',
    ])
    // Real-world names pass: spaces, digits, hyphens are the Google Fonts idiom.
    const ok = parsePortfolio(rawPortfolio({ settings: settings('Noto Sans JP') }))
    if (!ok.ok) throw new Error(JSON.stringify(ok.errors))
    expect(ok.portfolio.settings.theme.font).toBe('Noto Sans JP')
  })

  it('keeps a valid inline logo and refuses an invalid or oversized one', () => {
    const identity = (logo: string) => ({
      identity: { org: 'a', unit: 'b', logo },
      show: { healthDashboard: true, recap: true, archives: true, decisions: true },
      recapRows: 11,
    })
    const ok = parsePortfolio(
      rawPortfolio({ settings: identity('data:image/svg+xml;base64,PHN2Zy8+') }),
    )
    if (!ok.ok) throw new Error(JSON.stringify(ok.errors))
    expect(ok.portfolio.settings.identity.logo).toMatch(/^data:image\//)

    expect(
      faults(parsePortfolio(rawPortfolio({ settings: identity('https://example.com/l.png') }))),
    ).toEqual(['settings.identity.logo invalidLogo'])
    expect(
      faults(
        parsePortfolio(
          rawPortfolio({ settings: identity(`data:image/png;base64,${'A'.repeat(400_001)}`) }),
        ),
      ),
    ).toEqual(['settings.identity.logo oversizedLogo'])
  })
})

describe('refusal — rows and slides', () => {
  it('refuses a decision without a question and a half-filled outcome', () => {
    const r = parsePortfolio(
      rawPortfolio({
        projects: [
          rawProject({
            decisions: [{ decider: 'Direction' }, { question: 'Q ?', taken: { text: 'ok' } }],
          }),
        ],
      }),
    )
    expect(faults(r)).toEqual([
      'projects[0].decisions[0].question missingKey',
      'projects[0].decisions[1].taken.when missingKey',
    ])
  })

  it('refuses a milestone missing its date, label or done flag', () => {
    const r = parsePortfolio(
      rawPortfolio({
        projects: [rawProject({ milestones: [{ label: 'J' }, { date: 'T1 2026', done: false }] })],
      }),
    )
    expect(faults(r)).toEqual([
      'projects[0].milestones[0].date missingKey',
      'projects[0].milestones[0].done missingKey',
      'projects[0].milestones[1].label missingKey',
      'projects[0].milestones[1].date invalidDate',
    ])
  })

  it('readPortfolioJson: size cap BEFORE JSON.parse, badJson under it, parse result through', () => {
    // A brace repeated a hair past the cap: the refusal must be the size one —
    // JSON.parse is never reached.
    const oversized = '{'.repeat(IMPORT_MAX_CHARS + 1)
    expect(readPortfolioJson(oversized)).toEqual({ ok: false, refusal: 'tooLarge' })
    expect(readPortfolioJson('{ not json')).toEqual({ ok: false, refusal: 'badJson' })
    const r = readPortfolioJson(JSON.stringify(rawPortfolio()))
    expect(r.ok).toBe(true)
  })

  it('accepts an empty milestone label and an empty free-slide title — the display owns the dash', () => {
    const r = parsePortfolio(
      rawPortfolio({
        projects: [rawProject({ milestones: [{ label: '', date: '2026-03-01', done: false }] })],
        freeSlides: [{ id: 'sl-1', title: '', anchor: { type: 'closing' }, blocks: [['l']] }],
      }),
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.portfolio.projects[0]?.milestones[0]?.label).toBe('')
      expect(r.portfolio.freeSlides[0]?.title).toBe('')
    }
  })

  it('refuses a block that is not an array, and a line that is not a string', () => {
    const slide = { id: 'sl-1', title: 'T', anchor: { type: 'closing' } }
    expect(
      faults(parsePortfolio(rawPortfolio({ freeSlides: [{ ...slide, blocks: ['x'] }] }))),
    ).toEqual(['freeSlides[0].blocks[0] wrongType'])
    expect(
      faults(parsePortfolio(rawPortfolio({ freeSlides: [{ ...slide, blocks: [['a', 7]] }] }))),
    ).toEqual(['freeSlides[0].blocks[0][1] wrongType'])
  })

  it('refuses a free slide with a malformed anchor or no block', () => {
    const slide = { id: 'sl-1', title: 'T', blocks: [['l']] }
    expect(
      faults(parsePortfolio(rawPortfolio({ freeSlides: [{ ...slide, anchor: 'closing' }] }))),
    ).toEqual(['freeSlides[0].anchor wrongType'])
    expect(
      faults(
        parsePortfolio(rawPortfolio({ freeSlides: [{ ...slide, anchor: { type: 'middle' } }] })),
      ),
    ).toEqual(['freeSlides[0].anchor.type invalidEnum'])
    expect(
      faults(
        parsePortfolio(
          rawPortfolio({ freeSlides: [{ ...slide, anchor: { type: 'beforeCategory' } }] }),
        ),
      ),
    ).toEqual(['freeSlides[0].anchor.categoryId missingKey'])
    expect(
      faults(
        parsePortfolio(
          rawPortfolio({
            freeSlides: [{ ...slide, anchor: { type: 'beforeCategory', categoryId: '' } }],
          }),
        ),
      ),
    ).toEqual(['freeSlides[0].anchor.categoryId emptyId'])
    expect(
      faults(
        parsePortfolio(
          rawPortfolio({ freeSlides: [{ ...slide, anchor: { type: 'closing' }, blocks: [] }] }),
        ),
      ),
    ).toEqual(['freeSlides[0].blocks emptyBlocks'])
  })
})

describe('the report is exhaustive, never first-fault', () => {
  it('a file with 3 faults reports exactly 3 errors', () => {
    const r = parsePortfolio(
      rawPortfolio({
        review: { title: 't', reviewDate: '2026-13-01' }, // fault 1: invalid date
        categories: [{ id: 'c1', name: 'C', color: 'fuchsia' }], // fault 2: unknown color
        projects: [rawProject({ progress: 150 })], // fault 3: progress out of range
      }),
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors).toHaveLength(3)
    expect(faults(r)).toEqual([
      'review.reviewDate invalidDate',
      'categories[0].color invalidEnum',
      'projects[0].progress invalidProgress',
    ])
  })

  it('every emitted code belongs to the closed list', () => {
    const r = parsePortfolio(
      rawPortfolio({
        version: 4,
        rogue: true,
        review: { title: 't' },
        projects: [rawProject({ id: '', progress: -1, stage: 'x' })],
        freeSlides: [{ id: 'sl-1', title: 'T', anchor: { type: 'closing' }, blocks: [] }],
      }),
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    for (const e of r.errors) expect(PARSE_ERROR_CODES).toContain(e.code)
  })
})

describe('sample data — schema and parse agree', () => {
  const ajv = new Ajv({ allErrors: true })
  const validate = ajv.compile(schema)

  it('french data set: schema-valid AND parse-accepted', () => {
    expect(validate(rawFr), JSON.stringify(validate.errors)).toBe(true)
    expect(parsePortfolio(rawFr).ok).toBe(true)
  })

  it('english data set: schema-valid AND parse-accepted', () => {
    expect(validate(rawEn), JSON.stringify(validate.errors)).toBe(true)
    expect(parsePortfolio(rawEn).ok).toBe(true)
  })

  it('a file with an unknown key is refused by BOTH the schema and the parse', () => {
    const withIntruder = { ...rawPortfolio(), backgroundColor: '#FF0000' }
    expect(validate(withIntruder)).toBe(false)
    expect(parsePortfolio(withIntruder).ok).toBe(false)
  })
})
