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
  PARSE_ERROR_CODES,
  parsePortfolio,
  readPortfolioJson,
  type ParseResult,
} from '../../../src/services/parse/index'
import {
  MAX_CHARS,
  MAX_ENTITIES,
  MAX_ROWS,
  serializedLength,
  withinMemoryBudget,
} from '../../../src/model/budget'
import { deck } from '../../../src/projections/index'
import { rawPortfolio, rawProject } from '../../fixtures/raw-portfolios'

/** `path code` fingerprints of a refusal — the shape most assertions read. */
function faults(r: ParseResult): readonly string[] {
  if (r.ok) throw new Error('expected a refusal')
  return r.errors.map((e) => `${e.path} ${e.code}`)
}

describe('acceptance — a contract-valid file parses whole', () => {
  it('navigation is optional in v3 and both file gates agree on its closed values', () => {
    const validate = new Ajv({ strict: false }).compile(schema)
    for (const navigation of [undefined, 'sections', 'linear', 'diagonal', null, 1]) {
      const source = JSON.parse(
        JSON.stringify({ ...rawFr, settings: { ...rawFr.settings, navigation } }),
      )
      const accepted =
        navigation === undefined || navigation === 'sections' || navigation === 'linear'
      const parsed = parsePortfolio(source)
      expect(parsed.ok).toBe(accepted)
      expect(validate(source)).toBe(accepted)
      if (parsed.ok) {
        expect(parsed.portfolio.settings.navigation).toBe(navigation)
        expect(Object.hasOwn(parsed.portfolio.settings, 'navigation')).toBe(
          navigation !== undefined,
        )
      }
    }
  })
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
    // Real-world names pass: spaces, digits and hyphens are the web idiom.
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

  /* ---- embedded font faces (settings.theme.fontFaces) ---- */

  const themed = (fontFaces: unknown) => ({
    identity: { org: 'a', unit: 'b' },
    theme: { font: 'Atelier', fontFaces },
    show: { healthDashboard: true, recap: true, archives: true, decisions: true },
    recapRows: 11,
  })
  /** A clean face — `n` sizes the base64 payload. */
  const face = (over: Record<string, unknown> = {}, n = 8) => ({
    family: 'Atelier',
    weight: '400',
    style: 'normal',
    dataUri: `data:font/woff2;base64,${'A'.repeat(n)}`,
    ...over,
  })

  it('accepts embedded faces, defaulting weight to 400 and style to normal', () => {
    const r = parsePortfolio(
      rawPortfolio({
        settings: themed([
          face({ weight: '700' }),
          { family: 'Atelier', dataUri: 'data:font/woff2;base64,d09GMg==' },
          face({ weight: '500 600', style: 'italic' }),
        ]),
      }),
    )
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    expect(r.portfolio.settings.theme.fontFaces).toHaveLength(3)
    expect(r.portfolio.settings.theme.fontFaces![1]).toEqual({
      family: 'Atelier',
      weight: '400',
      style: 'normal',
      dataUri: 'data:font/woff2;base64,d09GMg==',
    })
    expect(r.portfolio.settings.theme.fontFaces![2]!.weight).toBe('500 600')
    expect(r.portfolio.settings.theme.fontFaces![2]!.style).toBe('italic')
  })

  it('refuses duplicate font slots, including omitted descriptor defaults and different bytes', () => {
    for (const duplicate of [
      face(),
      face({}, 16),
      { family: 'Atelier', dataUri: face().dataUri },
    ]) {
      expect(
        faults(parsePortfolio(rawPortfolio({ settings: themed([face(), duplicate]) }))),
      ).toEqual(['settings.theme.fontFaces[1] duplicateFontFace'])
    }
  })

  it('normalises an empty fontFaces array to key absence — [] means "none embedded"', () => {
    const r = parsePortfolio(rawPortfolio({ settings: themed([]) }))
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    expect('fontFaces' in r.portfolio.settings.theme).toBe(false)
  })

  it('refuses a dataUri outside the exact woff2 base64 shape — it lands in @font-face CSS', () => {
    const bad = [
      'data:font/ttf;base64,AAAA', // wrong MIME
      'data:font/woff2;base64,', // empty payload
      'data:font/woff2;base64,AA"A', // charset break — a CSS url() escape
      'data:font/woff2,rawtext', // not base64-flagged
      'https://example.com/f.woff2', // not a data URI at all
    ]
    for (const dataUri of bad) {
      const r = parsePortfolio(rawPortfolio({ settings: themed([face({ dataUri })]) }))
      expect(faults(r)).toEqual(['settings.theme.fontFaces[0].dataUri invalidFontFace'])
    }
  })

  it('refuses a face family outside the font charset and a malformed weight', () => {
    expect(
      faults(parsePortfolio(rawPortfolio({ settings: themed([face({ family: 'X</style>' })]) }))),
    ).toEqual(['settings.theme.fontFaces[0].family invalidFont'])
    for (const weight of ['99', '901', 'bold', '700 500', '400-700', '4000']) {
      const r = parsePortfolio(rawPortfolio({ settings: themed([face({ weight })]) }))
      expect(faults(r)).toEqual(['settings.theme.fontFaces[0].weight invalidFontWeight'])
    }
    expect(
      faults(parsePortfolio(rawPortfolio({ settings: themed([face({ style: 'oblique' })]) }))),
    ).toEqual(['settings.theme.fontFaces[0].style invalidEnum'])
  })

  it('collects every fault of every face — the report is exhaustive', () => {
    const r = parsePortfolio(
      rawPortfolio({
        settings: themed([
          { family: '', weight: '9', style: 'wide', dataUri: 'nope', extra: true },
          face(),
        ]),
      }),
    )
    expect(faults(r)).toEqual([
      'settings.theme.fontFaces[0].extra unknownKey',
      'settings.theme.fontFaces[0].family invalidFont',
      'settings.theme.fontFaces[0].weight invalidFontWeight',
      'settings.theme.fontFaces[0].style invalidEnum',
      'settings.theme.fontFaces[0].dataUri invalidFontFace',
    ])
  })

  it('caps one face at 550k data-URI characters (~400 KB of binary)', () => {
    // 23 prefix chars + payload: one over the cap trips, at the cap passes.
    const r = parsePortfolio(rawPortfolio({ settings: themed([face({}, 550_001 - 23)]) }))
    expect(faults(r)).toEqual(['settings.theme.fontFaces[0].dataUri oversizedFontFace'])
    if (!r.ok) expect(r.errors[0]!.params).toEqual({ max: '550' })
    const ok = parsePortfolio(rawPortfolio({ settings: themed([face({}, 550_000 - 23)]) }))
    expect(ok.ok).toBe(true)
  })

  it('caps all faces together at 2M data-URI characters (~1.5 MB of binary)', () => {
    // Four faces of 550 000 chars each: every one under its own cap, the
    // sum (2 200 000) over the collection's.
    const four = ['400', '500', '600', '700'].map((weight) => face({ weight }, 550_000 - 23))
    const r = parsePortfolio(rawPortfolio({ settings: themed(four) }))
    expect(faults(r)).toEqual(['settings.theme.fontFaces oversizedFontFaces'])
    if (!r.ok) expect(r.errors[0]!.params).toEqual({ max: '2000' })
  })

  it('refuses a non-array fontFaces value', () => {
    expect(faults(parsePortfolio(rawPortfolio({ settings: themed('Atelier.woff2') })))).toEqual([
      'settings.theme.fontFaces wrongType',
    ])
  })

  /* ---- the portfolio's own palette (settings.theme.customPalette) ---- */

  const withPalette = (customPalette: unknown) => ({
    identity: { org: 'a', unit: 'b' },
    theme: { customPalette },
    show: { healthDashboard: true, recap: true, archives: true, decisions: true },
    recapRows: 11,
  })
  /** The twelve names, all valid — the base every refusal below breaks. */
  const twelve = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    blue: '#3460d8',
    indigo: '#7a4ecf',
    teal: '#017661',
    cyan: '#016770',
    green: '#027a1f',
    olive: '#666f02',
    amber: '#7e5e01',
    orange: '#a35301',
    red: '#c52b30',
    purple: '#a43cab',
    brown: '#7d4e2c',
    taupe: '#6b6456',
    ...over,
  })

  it('accepts the twelve colours, with or without a label', () => {
    const r = parsePortfolio(
      rawPortfolio({ settings: withPalette({ label: 'House', colors: twelve() }) }),
    )
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    expect(r.portfolio.settings.theme.customPalette).toEqual({
      label: 'House',
      colors: twelve(),
    })
    const bare = parsePortfolio(rawPortfolio({ settings: withPalette({ colors: twelve() }) }))
    if (!bare.ok) throw new Error(JSON.stringify(bare.errors))
    expect('label' in bare.portfolio.settings.theme.customPalette!).toBe(false)
  })

  it('leaves the key absent when the portfolio carries no palette of its own', () => {
    const r = parsePortfolio(rawPortfolio())
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    expect('customPalette' in r.portfolio.settings.theme).toBe(false)
  })

  it('refuses anything but an exact six-digit hex — the value lands in CSS', () => {
    const bad = [
      '#abc', // three-digit shorthand
      '#3460d8ff', // eight-digit alpha form
      '3460d8', // no hash
      'rebeccapurple', // named colour
      'rgb(52 96 216)', // functional notation
      'var(--x)', // a CSS reference
      '#3460d8;}', // a declaration break
      'inherit', // a CSS-wide keyword
    ]
    for (const value of bad) {
      const r = parsePortfolio(
        rawPortfolio({ settings: withPalette({ colors: twelve({ blue: value }) }) }),
      )
      expect(faults(r)).toEqual(['settings.theme.customPalette.colors.blue invalidPaletteColor'])
    }
  })

  it('demands the twelve names — an incomplete table is refused, name by name', () => {
    const partial = twelve()
    delete partial['taupe']
    delete partial['brown']
    const r = parsePortfolio(rawPortfolio({ settings: withPalette({ colors: partial }) }))
    expect(faults(r)).toEqual([
      'settings.theme.customPalette.colors.brown missingKey',
      'settings.theme.customPalette.colors.taupe missingKey',
    ])
  })

  it('refuses a thirteenth name — including the grey sentinel, which is not a category colour', () => {
    const r = parsePortfolio(
      rawPortfolio({ settings: withPalette({ colors: twelve({ grey: '#757575' }) }) }),
    )
    expect(faults(r)).toEqual(['settings.theme.customPalette.colors.grey unknownKey'])
  })

  it('collects every faulty colour in one pass, and the structural faults with them', () => {
    const r = parsePortfolio(
      rawPortfolio({
        settings: withPalette({
          tint: 'warm',
          colors: twelve({ blue: '#xyzxyz', red: 42, purple: '#a43cab77' }),
        }),
      }),
    )
    expect(faults(r)).toEqual([
      'settings.theme.customPalette.tint unknownKey',
      'settings.theme.customPalette.colors.blue invalidPaletteColor',
      'settings.theme.customPalette.colors.red wrongType',
      'settings.theme.customPalette.colors.purple invalidPaletteColor',
    ])
  })

  it('refuses a palette that is not an object, and a colours table that is not one', () => {
    expect(faults(parsePortfolio(rawPortfolio({ settings: withPalette('house') })))).toEqual([
      'settings.theme.customPalette wrongType',
    ])
    const r = parsePortfolio(rawPortfolio({ settings: withPalette({ colors: ['#3460d8'] }) }))
    expect(faults(r)).toContain('settings.theme.customPalette.colors wrongType')
  })

  it('refuses a palette with no colours table at all', () => {
    expect(
      faults(parsePortfolio(rawPortfolio({ settings: withPalette({ label: 'House' }) }))),
    ).toEqual(['settings.theme.customPalette.colors missingKey'])
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
    const oversized = '{'.repeat(MAX_CHARS + 1)
    expect(readPortfolioJson(oversized)).toEqual({ ok: false, refusal: 'tooLarge' })
    expect(readPortfolioJson('{ not json')).toEqual({ ok: false, refusal: 'badJson' })
    const r = readPortfolioJson(JSON.stringify(rawPortfolio()))
    expect(r.ok).toBe(true)
  })

  /**
   * THE READER MEASURES THE DOCUMENT, NOT ONLY THE BYTES IT ARRIVED IN. A
   * COMPACT file under the cap becomes an INDENTED document over it — the same
   * content, two lengths — and the command gate weighs the second one. A
   * reader that only weighed the first accepted such a file, reported it valid,
   * and let the import dialog dispatch a `ReplacePortfolio` the gate refused:
   * the dialog closed and the portfolio had not changed.
   */
  it('refuses a compact file whose own serialised form would be over the cap', () => {
    // 140 projects, three full narrative lists each, one character per line —
    // every per-collection and per-entity rule honoured. What crosses the
    // ceiling is the INDENTATION those 840 000 lines take once the document is
    // serialised (3.4 M compact, 11 M indented), and nothing else.
    const lines = Array.from({ length: MAX_ROWS }, () => 'x')
    const raw = rawPortfolio({
      projects: Array.from({ length: 140 }, (_, i) =>
        rawProject({ id: `P-${i}`, done: lines, ongoing: lines, next: lines }),
      ),
    })
    const compact = JSON.stringify(raw)
    expect(compact.length).toBeLessThan(MAX_CHARS)

    // The strict parse says yes: it is asked about the file, and the file is
    // faultless.
    const parsed = parsePortfolio(raw)
    expect(parsed.ok).toBe(true)
    // The document it builds is past the ceiling all the same — this is the
    // very measure the command gate applies (`withinMemoryBudget`), so what
    // the reader refuses `decide` refuses, and the import dialog can name the
    // refusal before anything is replaced.
    expect(parsed.ok && serializedLength(parsed.portfolio)).toBeGreaterThan(MAX_CHARS)
    expect(parsed.ok && withinMemoryBudget(parsed.portfolio)).toBe(false)
    expect(readPortfolioJson(compact)).toEqual({ ok: false, refusal: 'tooLarge' })
  })

  /**
   * The entity ceiling. The byte cap does not bound this: 10 MB of JSON holds
   * thousands of projects, each of which derives a slide — and the application
   * measurably stops answering well before the byte cap is reached.
   */
  it('refuses more entities than the application can carry, counting the three collections together', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => rawProject({ id: `P-${i}`, name: `P${i}` }))

    const justUnder = parsePortfolio(rawPortfolio({ projects: many(MAX_ENTITIES - 1) }))
    expect(justUnder.ok).toBe(true)

    const justOver = parsePortfolio(rawPortfolio({ projects: many(MAX_ENTITIES + 1) }))
    expect(justOver.ok).toBe(false)
    if (justOver.ok) throw new Error('expected a refusal')
    // ONE error, and nothing else: the point of counting first is that the
    // elements are never walked, so no per-element report can exist.
    expect(justOver.errors).toEqual([
      {
        path: '',
        code: 'tooManyEntities',
        params: { max: String(MAX_ENTITIES), count: String(MAX_ENTITIES + 1) },
      },
    ])
  })

  it('the ceiling counts categories and free slides too, not projects alone', () => {
    const half = Math.floor(MAX_ENTITIES / 2)
    const categories = Array.from({ length: half }, (_, i) => ({
      id: `c-${i}`,
      name: `C${i}`,
      color: 'blue' as const,
    }))
    const slides = Array.from({ length: half + 1 }, (_, i) => ({
      id: `s-${i}`,
      title: `S${i}`,
      anchor: { type: 'closing' as const },
      blocks: [['line']],
    }))
    const r = parsePortfolio(rawPortfolio({ categories, freeSlides: slides, projects: [] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]?.code).toBe('tooManyEntities')
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

  it('refuses malformed Unicode in ids and category references on both sides', () => {
    for (const id of ['\ud800', '\udfff', 'a\ud800b']) {
      const raw = rawPortfolio({
        categories: [{ id, name: 'X', color: 'blue' }],
        projects: [rawProject({ id, categoryId: id })],
        freeSlides: [
          { id, anchor: { type: 'beforeCategory', categoryId: id }, title: '', blocks: [[]] },
        ],
      })
      expect(validate(raw)).toBe(false)
      expect(faults(parsePortfolio(raw))).toEqual([
        'categories[0].id invalidId',
        'projects[0].categoryId invalidId',
        'projects[0].id invalidId',
        'freeSlides[0].id invalidId',
        'freeSlides[0].anchor.categoryId invalidId',
      ])
    }
  })

  it('keeps emoji, decomposed accents and orphan references unchanged', () => {
    const id = '🚀/e\u0301'
    const raw = rawPortfolio({
      categories: [{ id, name: 'X', color: 'blue' }],
      projects: [
        rawProject({ id, categoryId: '東京' }),
        rawProject({ id: 'autre', categoryId: '' }),
      ],
      freeSlides: [
        { id, anchor: { type: 'beforeCategory', categoryId: id }, title: '', blocks: [[]] },
      ],
    })
    expect(validate(raw)).toBe(true)
    const parsed = parsePortfolio(raw)
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors))
    expect(parsed.portfolio.projects[0]!.id).toBe(id)
    expect(parsed.portfolio.projects[0]!.categoryId).toBe('東京')
    expect(parsed.portfolio.projects[1]!.categoryId).toBe('')
    expect(readPortfolioJson(JSON.stringify(parsed.portfolio)).ok).toBe(true)
  })

  it('rejects identical font objects in the schema and documents the stronger slot rule', () => {
    const face = { family: 'Atelier', dataUri: 'data:font/woff2;base64,AAAA' }
    const raw = rawPortfolio()
    raw.settings = { ...(raw.settings as object), theme: { fontFaces: [face, { ...face }] } }
    expect(validate(raw)).toBe(false)
    expect(faults(parsePortfolio(raw))).toEqual(['settings.theme.fontFaces[1] duplicateFontFace'])
    expect(schema.properties.settings.properties.theme.properties.fontFaces.description).toContain(
      'slot',
    )
  })

  it('french data set: schema-valid AND parse-accepted', () => {
    expect(validate(rawFr), JSON.stringify(validate.errors)).toBe(true)
    expect(parsePortfolio(rawFr).ok).toBe(true)
  })

  it('english data set: schema-valid AND parse-accepted', () => {
    expect(validate(rawEn), JSON.stringify(validate.errors)).toBe(true)
    expect(parsePortfolio(rawEn).ok).toBe(true)
  })

  it('the schema also refuses the unknown root key covered by the parse tests', () => {
    const withIntruder = { ...rawPortfolio(), backgroundColor: '#FF0000' }
    expect(validate(withIntruder)).toBe(false)
  })
})
