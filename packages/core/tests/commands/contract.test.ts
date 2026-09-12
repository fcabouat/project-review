/**
 * THE MEMORY/FILE CONTRACT (`src/commands/contract.ts`) — the rule that the
 * running portfolio may never hold a value its own file format would refuse to
 * read back.
 *
 * Two halves, and both are needed:
 *  - POSITIVE — every command the editor legitimately emits leaves a portfolio
 *    that survives serialisation and comes back through the strict parse
 *    whole. One test over the exhaustive command table;
 *  - NEGATIVE — the INVENTORY below: one faulty command per rule the parse
 *    enforces, each refused by `decide`. It is written as a flat table on
 *    purpose: read against `services/parse/**`, a rule with no line here is a
 *    hole, and a line here with no rule there is an invention.
 *
 * The deliberate casts are the whole point: every command is well typed, and
 * types are not the guard — a form's edge, a replayed payload or a
 * hand-written command carries whatever it carries at runtime.
 */
import { describe, expect, it } from 'vitest'
import type { Category } from '../../src/model/category'
import type { FreeSlide } from '../../src/model/free-slide'
import type { Portfolio } from '../../src/model/portfolio'
import type { Project } from '../../src/model/project'
import type { CustomPalette, EmbeddedFontFace } from '../../src/model/theme'
import { isoDate } from '../../src/values/date'
import { FONT_FACE_MAX_CHARS, FONT_FACES_TOTAL_MAX_CHARS } from '../../src/values/font'
import { LOGO_MAX_CHARS } from '../../src/values/logo'
import { apply } from '../../src/events/index'
import { decide, type Command } from '../../src/commands/index'
import { parsePortfolio } from '../../src/services/parse'
import { serializePortfolio } from '../../src/services/portfolio-json'
import { NEW_PROJECT, testPortfolio } from '../fixtures/hand-built-portfolios'
import { COMMAND_SAMPLES } from '../fixtures/command-samples'

const p = testPortfolio()

/** A value the compiler would refuse — exactly what a runtime guard is for. */
const forged = <T>(x: unknown): T => x as T

/** A woff2 data URI of the requested length, honoring the shape. */
const woff2 = (chars: number): string => {
  const head = 'data:font/woff2;base64,'
  return head + 'A'.repeat(Math.max(1, chars - head.length))
}

const face = (over: Partial<EmbeddedFontFace> = {}): EmbeddedFontFace => ({
  family: 'Atelier',
  weight: '400',
  style: 'normal',
  dataUri: woff2(64),
  ...over,
})

/** A complete twelve-colour table, one entry breakable at a time. */
const housePalette = (over: Record<string, unknown> = {}): CustomPalette =>
  forged({
    label: 'House',
    colors: {
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
    },
  })

/* ====================================================================== */
/* POSITIVE — what the editor emits, the format reads back                */
/* ====================================================================== */

describe('what a command produces, the file format reads back', () => {
  it('accepts distinct font variants and refuses a duplicate slot regardless of bytes', () => {
    const distinct = [face(), face({ weight: '700' }), face({ style: 'italic' })]
    const event = decide(p, { type: 'ChangeSetting', setting: 'fontFaces', after: distinct })
    expect(event).toBeDefined()
    expect(parsePortfolio(JSON.parse(serializePortfolio(apply(p, event!)))).ok).toBe(true)
    for (const after of [
      [face(), face()],
      [face(), face({ dataUri: woff2(128) })],
    ]) {
      expect(decide(p, { type: 'ChangeSetting', setting: 'fontFaces', after })).toBeUndefined()
    }
  })

  it('refuses unaddressable Unicode ids and references at every command boundary', () => {
    const bad = '\ud800'
    const slide = { id: 's', anchor: { type: 'closing' }, title: '', blocks: [[]] }
    const commands = [
      { type: 'CreateProject', project: { ...NEW_PROJECT, id: bad }, index: 0 },
      { type: 'RenumberProject', id: p.projects[0]!.id, newId: bad },
      { type: 'ChangeProjectField', id: p.projects[0]!.id, field: 'categoryId', after: bad },
      { type: 'CreateCategory', category: { id: bad, name: 'x', color: 'blue' }, index: 0 },
      { type: 'CreateFreeSlide', slide: { ...slide, id: bad }, index: 0 },
      {
        type: 'CreateFreeSlide',
        slide: { ...slide, anchor: { type: 'beforeCategory', categoryId: bad } },
        index: 0,
      },
    ]
    for (const command of commands) expect(decide(p, forged(command)), command.type).toBeUndefined()
  })
  it('holds for every command variant of the exhaustive table', () => {
    for (const [name, { command }] of Object.entries(COMMAND_SAMPLES)) {
      const event = decide(p, command)
      expect(event, name).toBeDefined()
      // The full round trip a reload performs: serialise, re-read strictly.
      const reread = parsePortfolio(JSON.parse(serializePortfolio(apply(p, event!))))
      if (!reread.ok) {
        throw new Error(
          `${name} produced an unreadable portfolio: ${JSON.stringify(reread.errors)}`,
        )
      }
    }
  })

  it('holds for the font families the charset allows', () => {
    // Anything but the fixture's own family, which `decide` drops as trivial.
    for (const family of ['Roboto', 'Atelier', 'IBM Plex Sans', 'Noto_Sans-2']) {
      const event = decide(p, { type: 'ChangeSetting', setting: 'font', after: family })
      expect(event, family).toBeDefined()
      expect(parsePortfolio(JSON.parse(serializePortfolio(apply(p, event!)))).ok).toBe(true)
    }
  })
})

/* ====================================================================== */
/* NEGATIVE — the inventory: one faulty command per parse rule            */
/* ====================================================================== */

/** One line of the inventory: the rule, and a command that breaks it. */
type Case = readonly [rule: string, command: Command]

const refused = (cases: readonly Case[]): void => {
  for (const [rule, command] of cases) {
    it(`refuses: ${rule}`, () => {
      expect(decide(p, command)).toBeUndefined()
    })
  }
}

describe('review — the `review` block rules', () => {
  refused([
    [
      'reviewDate must be a CALENDAR date (invalidDate)',
      { type: 'ChangeReviewField', field: 'reviewDate', after: forged('2026-02-30') },
    ],
    [
      'reviewDate must have the YYYY-MM-DD shape (invalidDate)',
      { type: 'ChangeReviewField', field: 'reviewDate', after: forged('03/09/2026') },
    ],
    [
      'reviewDate is required — it cannot be erased (missingKey)',
      { type: 'ChangeReviewField', field: 'reviewDate', after: forged(undefined) },
    ],
    [
      'previousReviewDate, when present, is a calendar date (invalidDate)',
      { type: 'ChangeReviewField', field: 'previousReviewDate', after: forged('2026-13-01') },
    ],
    [
      'title is a string (wrongType)',
      { type: 'ChangeReviewField', field: 'title', after: forged(42) },
    ],
    [
      'subtitle, when present, is a string (wrongType)',
      { type: 'ChangeReviewField', field: 'subtitle', after: forged(7) },
    ],
  ])
})

describe('identity — the organization kit rules', () => {
  refused([
    [
      'org is required (missingKey)',
      { type: 'ChangeIdentityField', field: 'org', after: forged(undefined) },
    ],
    [
      'unit is required (missingKey)',
      { type: 'ChangeIdentityField', field: 'unit', after: forged(undefined) },
    ],
    [
      'org is a string (wrongType)',
      { type: 'ChangeIdentityField', field: 'org', after: forged(42) },
    ],
    [
      'contact, when present, is a string (wrongType)',
      { type: 'ChangeIdentityField', field: 'contact', after: forged(true) },
    ],
    [
      'logo must be a data:image/… URI (invalidLogo)',
      { type: 'ChangeIdentityField', field: 'logo', after: 'https://example.org/logo.png' },
    ],
    [
      'logo must be a data URI at all (invalidLogo)',
      { type: 'ChangeIdentityField', field: 'logo', after: 'data:text/plain;base64,QQ==' },
    ],
    [
      'logo stays under the size guard (oversizedLogo)',
      {
        type: 'ChangeIdentityField',
        field: 'logo',
        after: `data:image/png;base64,${'A'.repeat(LOGO_MAX_CHARS)}`,
      },
    ],
  ])
})

describe('theme — the font rules (the charset is a security line)', () => {
  refused([
    // The exact value of the reproduced data loss: accepted in memory,
    // refused by the parse, stored document unreadable on the next boot.
    [
      'font stays in the letters/digits/space/_/- charset (invalidFont)',
      { type: 'ChangeSetting', setting: 'font', after: 'Times New Roman!!' },
    ],
    [
      'font refuses the quotes and angle brackets CSS would carry (invalidFont)',
      { type: 'ChangeSetting', setting: 'font', after: '"><style>x{}' },
    ],
    ['font is not empty (invalidFont)', { type: 'ChangeSetting', setting: 'font', after: '' }],
    [
      'font stops at 64 characters (invalidFont)',
      { type: 'ChangeSetting', setting: 'font', after: 'A'.repeat(65) },
    ],
    ['font is a string (wrongType)', { type: 'ChangeSetting', setting: 'font', after: forged(42) }],
    [
      'style is one of the closed layout families (invalidEnum)',
      { type: 'ChangeSetting', setting: 'style', after: forged('brutalist') },
    ],
    [
      'palette is one of the closed color families (invalidEnum)',
      { type: 'ChangeSetting', setting: 'palette', after: forged('neon') },
    ],
    [
      'language is one of the closed display languages (invalidEnum)',
      { type: 'ChangeSetting', setting: 'language', after: forged('es') },
    ],
  ])
})

describe('theme — the embedded-face rules', () => {
  refused([
    [
      'a face family honors the font charset (invalidFont)',
      {
        type: 'ChangeSetting',
        setting: 'fontFaces',
        after: [face({ family: 'Times New Roman!!' })],
      },
    ],
    [
      'a face weight is an integer 400–800 (invalidFontWeight)',
      { type: 'ChangeSetting', setting: 'fontFaces', after: [face({ weight: '399' })] },
    ],
    [
      'a face weight stays under 800 (invalidFontWeight)',
      { type: 'ChangeSetting', setting: 'fontFaces', after: [face({ weight: '900' })] },
    ],
    [
      'a face weight range is ASCENDING (invalidFontWeight)',
      { type: 'ChangeSetting', setting: 'fontFaces', after: [face({ weight: '600 500' })] },
    ],
    [
      'a face weight honors the shape (invalidFontWeight)',
      { type: 'ChangeSetting', setting: 'fontFaces', after: [face({ weight: 'bold' })] },
    ],
    [
      'a face style is normal or italic (invalidEnum)',
      {
        type: 'ChangeSetting',
        setting: 'fontFaces',
        after: [face({ style: forged('oblique') })],
      },
    ],
    [
      'a face dataUri is a woff2 data URI (invalidFontFace)',
      {
        type: 'ChangeSetting',
        setting: 'fontFaces',
        after: [face({ dataUri: 'data:font/ttf;base64,AAEAAA==' })],
      },
    ],
    [
      'a face dataUri carries clean base64 only (invalidFontFace)',
      {
        type: 'ChangeSetting',
        setting: 'fontFaces',
        after: [face({ dataUri: 'data:font/woff2;base64,AA==");}body{x:url(evil' })],
      },
    ],
    [
      'one face stays under the per-face guard (oversizedFontFace)',
      {
        type: 'ChangeSetting',
        setting: 'fontFaces',
        after: [face({ dataUri: woff2(FONT_FACE_MAX_CHARS + 1) })],
      },
    ],
    [
      'all faces together stay under the total guard (oversizedFontFaces)',
      {
        type: 'ChangeSetting',
        setting: 'fontFaces',
        after: [
          face({ weight: '400', dataUri: woff2(FONT_FACES_TOTAL_MAX_CHARS / 2 + 8) }),
          face({ weight: '700', dataUri: woff2(FONT_FACES_TOTAL_MAX_CHARS / 2 + 8) }),
        ],
      },
    ],
    // `[]` is not a state the format has: the parse normalises it to absence,
    // so storing it would mean writing a key that reads back as another value.
    [
      'an EMPTY face list is not a stored state — absence is (normalisation)',
      { type: 'ChangeSetting', setting: 'fontFaces', after: [] },
    ],
  ])
})

describe('theme — the portfolio palette rules', () => {
  refused([
    [
      'a colour is an EXACT six-digit hex, not a shorthand (invalidPaletteColor)',
      { type: 'ChangeSetting', setting: 'customPalette', after: housePalette({ blue: '#abc' }) },
    ],
    [
      'a colour carries no alpha channel (invalidPaletteColor)',
      {
        type: 'ChangeSetting',
        setting: 'customPalette',
        after: housePalette({ blue: '#3460d8ff' }),
      },
    ],
    [
      'a colour is not a CSS reference — it lands inside a declaration (invalidPaletteColor)',
      {
        type: 'ChangeSetting',
        setting: 'customPalette',
        after: housePalette({ red: 'var(--anything)' }),
      },
    ],
    [
      'a colour cannot break out of its declaration (invalidPaletteColor)',
      {
        type: 'ChangeSetting',
        setting: 'customPalette',
        after: housePalette({ red: '#c52b30;} :root{--x:1' }),
      },
    ],
    [
      'a colour is a string (wrongType)',
      {
        type: 'ChangeSetting',
        setting: 'customPalette',
        after: housePalette({ green: forged(0x027a1f) }),
      },
    ],
    [
      'the table carries the twelve names — an incomplete one is refused (missingKey)',
      {
        type: 'ChangeSetting',
        setting: 'customPalette',
        after: forged({ colors: { blue: '#3460d8' } }),
      },
    ],
    [
      'the table carries NO thirteenth name (unknownKey)',
      {
        type: 'ChangeSetting',
        setting: 'customPalette',
        after: housePalette({ grey: '#757575' }),
      },
    ],
    [
      'the colours are a table, not a list (wrongType)',
      { type: 'ChangeSetting', setting: 'customPalette', after: forged({ colors: ['#3460d8'] }) },
    ],
    [
      'the palette is an object (wrongType)',
      { type: 'ChangeSetting', setting: 'customPalette', after: forged('house') },
    ],
    [
      'a label is a string (wrongType)',
      {
        type: 'ChangeSetting',
        setting: 'customPalette',
        after: forged({ label: 12, colors: housePalette().colors }),
      },
    ],
  ])

  it('accepts a complete table, and accepts dropping it', () => {
    const set = decide(p, {
      type: 'ChangeSetting',
      setting: 'customPalette',
      after: housePalette(),
    })
    expect(set).toBeDefined()
    const carried = apply(p, set!)
    expect(parsePortfolio(JSON.parse(serializePortfolio(carried))).ok).toBe(true)

    const drop = decide(carried, {
      type: 'ChangeSetting',
      setting: 'customPalette',
      after: undefined,
    })
    expect(drop).toBeDefined()
    // Dropping ERASES the key: the chosen family applies again, and the file
    // goes back to being byte-identical to one that never carried a palette.
    expect('customPalette' in apply(carried, drop!).settings.theme).toBe(false)
  })
})

describe('settings — the display rules', () => {
  refused([
    [
      'navigation is a closed choice',
      { type: 'ChangeSetting', setting: 'navigation', after: forged('diagonal') },
    ],
    [
      'recapRows stays in the printable band, low end (invalidRecapRows)',
      { type: 'ChangeSetting', setting: 'recapRows', after: 5 },
    ],
    [
      'recapRows stays in the printable band, high end (invalidRecapRows)',
      { type: 'ChangeSetting', setting: 'recapRows', after: 17 },
    ],
    [
      'recapRows is an INTEGER (invalidRecapRows)',
      { type: 'ChangeSetting', setting: 'recapRows', after: 8.5 },
    ],
    [
      'recapRows is a number (invalidRecapRows)',
      { type: 'ChangeSetting', setting: 'recapRows', after: forged('8') },
    ],
    [
      'an aggregate-slide toggle is a boolean (wrongType)',
      { type: 'ChangeSetting', setting: 'healthDashboard', after: forged('yes') },
    ],
    [
      'the recap toggle is a boolean (wrongType)',
      { type: 'ChangeSetting', setting: 'recap', after: forged(1) },
    ],
  ])
})

describe('categories — the collection rules', () => {
  const category = (over: Partial<Category>): Category =>
    ({ id: 'fresh', name: 'Fresh', color: 'teal', ...over }) as Category

  refused([
    [
      'a category id is not empty (emptyId)',
      { type: 'CreateCategory', category: category({ id: forged('') }), index: 0 },
    ],
    [
      'a category id is unique in its collection (duplicateId)',
      { type: 'CreateCategory', category: category({ id: forged('infra') }), index: 0 },
    ],
    [
      'a category color is one of the twelve (invalidEnum)',
      { type: 'CreateCategory', category: category({ color: forged('grey') }), index: 0 },
    ],
    [
      'a category name is a string (wrongType)',
      { type: 'CreateCategory', category: category({ name: forged(3) }), index: 0 },
    ],
    [
      'a recolor stays in the twelve (invalidEnum)',
      { type: 'RecolorCategory', id: 'infra', after: forged('neon') },
    ],
    [
      'a rename carries a string (wrongType)',
      { type: 'RenameCategory', id: 'infra', after: forged(null) },
    ],
  ])
})

describe('projects — the central aggregate rules', () => {
  const project = (over: Partial<Project>): Project => ({ ...NEW_PROJECT, ...over })

  refused([
    [
      'a project id is not empty (emptyId)',
      { type: 'CreateProject', project: project({ id: forged('') }), index: 0 },
    ],
    [
      'a project id is unique in its collection (duplicateId)',
      { type: 'CreateProject', project: project({ id: forged('P-01') }), index: 0 },
    ],
    [
      'a stage is one of the six (invalidEnum)',
      { type: 'CreateProject', project: project({ stage: forged('mothballed') }), index: 0 },
    ],
    [
      'a sheet mode is one of the three (invalidEnum)',
      { type: 'CreateProject', project: project({ sheet: forged('sometimes') }), index: 0 },
    ],
    [
      'onHold is a boolean (wrongType)',
      { type: 'CreateProject', project: project({ onHold: forged('no') }), index: 0 },
    ],
    [
      'goal is required and a string (missingKey / wrongType)',
      { type: 'CreateProject', project: project({ goal: forged(undefined) }), index: 0 },
    ],
    [
      'a narrative list holds strings only (wrongType)',
      { type: 'CreateProject', project: project({ done: forged([1, 2]) }), index: 0 },
    ],
    [
      'a renumbering targets a non-empty id (emptyId)',
      { type: 'RenumberProject', id: forged('P-01'), newId: forged('') },
    ],
    [
      'progress is an integer 0–100, high end (invalidProgress)',
      { type: 'ChangeProjectField', id: 'P-01', field: 'progress', after: forged(101) },
    ],
    [
      'progress is an integer 0–100, low end (invalidProgress)',
      { type: 'ChangeProjectField', id: 'P-01', field: 'progress', after: forged(-1) },
    ],
    [
      'progress is an INTEGER (invalidProgress)',
      { type: 'ChangeProjectField', id: 'P-01', field: 'progress', after: forged(12.5) },
    ],
    [
      'health is one of the four levels (invalidEnum)',
      { type: 'ChangeProjectField', id: 'P-01', field: 'health', after: forged('doomed') },
    ],
    [
      'priority is one of the three (invalidEnum)',
      { type: 'ChangeProjectField', id: 'P-01', field: 'priority', after: forged('P9') },
    ],
    [
      'a project date is a calendar date (invalidDate)',
      { type: 'ChangeProjectField', id: 'P-01', field: 'start', after: forged('2026-02-31') },
    ],
    [
      'updatedOn is a calendar date (invalidDate)',
      { type: 'ChangeProjectField', id: 'P-01', field: 'updatedOn', after: forged('yesterday') },
    ],
    [
      'name is required and a string (missingKey)',
      { type: 'ChangeProjectField', id: 'P-01', field: 'name', after: forged(undefined) },
    ],
    [
      'categoryId is a string — `""` is the unassigned reference, not absence',
      { type: 'ChangeProjectField', id: 'P-01', field: 'categoryId', after: forged(undefined) },
    ],
    [
      'lead, when present, is a string (wrongType)',
      { type: 'ChangeProjectField', id: 'P-01', field: 'lead', after: forged(12) },
    ],
    [
      'a replaced narrative list holds strings only (wrongType)',
      { type: 'ChangeProjectList', id: 'P-01', list: 'next', after: forged(['ok', 42]) },
    ],
  ])
})

describe('projects — the row-collection rules', () => {
  refused([
    [
      'a milestone date is a calendar date (invalidDate)',
      {
        type: 'ChangeProjectMilestones',
        id: 'P-01',
        after: [forged({ label: 'x', date: '2026-02-30', done: false })],
      },
    ],
    [
      'a milestone date is required (missingKey)',
      { type: 'ChangeProjectMilestones', id: 'P-01', after: [forged({ label: 'x', done: false })] },
    ],
    [
      'a milestone label is a string (wrongType)',
      {
        type: 'ChangeProjectMilestones',
        id: 'P-01',
        after: [forged({ label: 3, date: '2026-03-10', done: false })],
      },
    ],
    [
      'a milestone `done` is a boolean (wrongType)',
      {
        type: 'ChangeProjectMilestones',
        id: 'P-01',
        after: [forged({ label: 'x', date: '2026-03-10', done: 'yes' })],
      },
    ],
    [
      'a milestone display, when present, is a string (wrongType)',
      {
        type: 'ChangeProjectMilestones',
        id: 'P-01',
        after: [forged({ label: 'x', date: '2026-03-10', display: 4, done: true })],
      },
    ],
    [
      'a decision question is a string (wrongType)',
      { type: 'ChangeProjectDecisions', id: 'P-01', after: [forged({ question: 9 })] },
    ],
    [
      'a settled outcome carries a calendar date (invalidDate)',
      {
        type: 'ChangeProjectDecisions',
        id: 'P-01',
        after: [forged({ question: 'q', taken: { text: 'done', when: 'soon' } })],
      },
    ],
    [
      'a settled outcome is all or nothing — no half-filled `taken` (missingKey)',
      {
        type: 'ChangeProjectDecisions',
        id: 'P-01',
        after: [forged({ question: 'q', taken: { text: 'done' } })],
      },
    ],
    [
      'a decision decider, when present, is a string (wrongType)',
      {
        type: 'ChangeProjectDecisions',
        id: 'P-01',
        after: [forged({ question: 'q', decider: 5 })],
      },
    ],
  ])
})

describe('free slides — the hand-written slide rules', () => {
  const slide = (over: Partial<FreeSlide>): FreeSlide =>
    ({
      id: 'free-9',
      anchor: { type: 'closing' },
      title: 'Fresh',
      blocks: [['a line']],
      ...over,
    }) as FreeSlide

  refused([
    [
      'a slide id is not empty (emptyId)',
      { type: 'CreateFreeSlide', slide: slide({ id: forged('') }), index: 0 },
    ],
    [
      'a slide id is unique in its collection (duplicateId)',
      { type: 'CreateFreeSlide', slide: slide({ id: forged('opening') }), index: 0 },
    ],
    [
      'a slide carries at least one block (emptyBlocks)',
      { type: 'CreateFreeSlide', slide: slide({ blocks: [] }), index: 0 },
    ],
    [
      'a block holds strings only (wrongType)',
      { type: 'CreateFreeSlide', slide: slide({ blocks: forged([['ok', 3]]) }), index: 0 },
    ],
    [
      'an anchor type is one of the three (invalidEnum)',
      { type: 'CreateFreeSlide', slide: slide({ anchor: forged({ type: 'middle' }) }), index: 0 },
    ],
    [
      'a beforeCategory anchor names a non-empty category (emptyId)',
      {
        type: 'CreateFreeSlide',
        slide: slide({ anchor: forged({ type: 'beforeCategory', categoryId: '' }) }),
        index: 0,
      },
    ],
    [
      'a slide title is a string (wrongType)',
      { type: 'CreateFreeSlide', slide: slide({ title: forged(0) }), index: 0 },
    ],
    [
      'a slide edit keeps at least one block (emptyBlocks)',
      {
        type: 'ChangeFreeSlide',
        id: 'opening',
        after: slide({ id: forged('opening'), blocks: [] }),
      },
    ],
    [
      'a slide edit keeps a non-empty id (emptyId)',
      { type: 'ChangeFreeSlide', id: 'opening', after: slide({ id: forged('') }) },
    ],
  ])

  it('refuses: a slide edit may not take an id another slide holds (duplicateId)', () => {
    const two: Portfolio = {
      ...p,
      freeSlides: [
        ...p.freeSlides,
        { id: forged('closing'), anchor: { type: 'closing' }, title: 'End', blocks: [['bye']] },
      ],
    }
    expect(
      decide(two, {
        type: 'ChangeFreeSlide',
        id: 'opening',
        after: slide({ id: forged('closing') }),
      }),
    ).toBeUndefined()
    // The same edit keeping its OWN id is accepted: the guard refuses the
    // collision, never the legitimate rename it exists to protect.
    expect(
      decide(two, {
        type: 'ChangeFreeSlide',
        id: 'opening',
        after: slide({ id: forged('free-9') }),
      }),
    ).toBeDefined()
  })
})

describe('whole-portfolio commands — the same rules, wholesale', () => {
  refused([
    [
      'a replacement is version 3 (invalidVersion)',
      { type: 'ReplacePortfolio', portfolio: forged({ ...testPortfolio(), version: 2 }) },
    ],
    [
      'a replacement holds unique project ids (duplicateId)',
      {
        type: 'ReplacePortfolio',
        portfolio: {
          ...testPortfolio(),
          projects: [...testPortfolio().projects, testPortfolio().projects[0]!],
        },
      },
    ],
    [
      'a replacement honors the font charset (invalidFont)',
      {
        type: 'ReplacePortfolio',
        portfolio: forged({
          ...testPortfolio(),
          settings: {
            ...testPortfolio().settings,
            theme: { ...testPortfolio().settings.theme, font: 'Times New Roman!!' },
          },
        }),
      },
    ],
    [
      'a replacement honors the recap band (invalidRecapRows)',
      {
        type: 'ReplacePortfolio',
        portfolio: forged({
          ...testPortfolio(),
          settings: { ...testPortfolio().settings, recapRows: 99 },
        }),
      },
    ],
    [
      'a merge carries sound projects (invalidEnum)',
      {
        type: 'MergeProjects',
        projects: [{ ...NEW_PROJECT, stage: forged('mothballed') }],
        categories: [],
      },
    ],
    [
      'a merge carries unique incoming ids (duplicateId)',
      { type: 'MergeProjects', projects: [NEW_PROJECT, NEW_PROJECT], categories: [] },
    ],
    [
      'a merge carries sound categories (invalidEnum)',
      {
        type: 'MergeProjects',
        projects: [NEW_PROJECT],
        categories: [forged({ id: 'x', name: 'X', color: 'neon' })],
      },
    ],
  ])
})

/**
 * Totality — the domain law that no function throws. A command whose payload
 * is missing altogether is refused like any other, not turned into a crash.
 */
describe('totality — a malformed payload is refused, never thrown on', () => {
  const malformed: readonly Command[] = [
    { type: 'CreateCategory', category: forged(undefined), index: 0 },
    { type: 'CreateProject', project: forged(undefined), index: 0 },
    { type: 'CreateFreeSlide', slide: forged(undefined), index: 0 },
    { type: 'ChangeFreeSlide', id: 'opening', after: forged(undefined) },
    { type: 'ChangeFreeSlide', id: 'opening', after: forged({ id: 'x', anchor: undefined }) },
    { type: 'ReplacePortfolio', portfolio: forged(undefined) },
    { type: 'ReplacePortfolio', portfolio: forged({ version: 3, review: undefined }) },
    {
      type: 'ReplacePortfolio',
      portfolio: forged({
        version: 3,
        review: { title: 'x', reviewDate: '2026-01-01' },
        settings: undefined,
      }),
    },
    {
      type: 'ReplacePortfolio',
      portfolio: forged({
        ...testPortfolio(),
        settings: { ...testPortfolio().settings, identity: undefined },
      }),
    },
    {
      type: 'ReplacePortfolio',
      portfolio: forged({
        ...testPortfolio(),
        settings: { ...testPortfolio().settings, theme: undefined },
      }),
    },
    {
      type: 'ReplacePortfolio',
      portfolio: forged({
        ...testPortfolio(),
        settings: { ...testPortfolio().settings, show: undefined },
      }),
    },
    { type: 'ChangeProjectMilestones', id: 'P-01', after: forged([undefined]) },
    { type: 'ChangeProjectDecisions', id: 'P-01', after: forged([undefined]) },
    { type: 'ChangeProjectMilestones', id: 'P-01', after: forged('not a list') },
    { type: 'ChangeProjectDecisions', id: 'P-01', after: forged('not a list') },
    { type: 'MergeProjects', projects: forged('nope'), categories: [] },
    { type: 'MergeProjects', projects: [], categories: forged('nope') },
    { type: 'ChangeSetting', setting: 'fontFaces', after: forged('nope') },
    { type: 'ChangeSetting', setting: 'fontFaces', after: forged([undefined]) },
    { type: 'ReplacePortfolio', portfolio: forged({ ...testPortfolio(), categories: 'nope' }) },
    { type: 'ReplacePortfolio', portfolio: forged({ ...testPortfolio(), projects: 'nope' }) },
    { type: 'ReplacePortfolio', portfolio: forged({ ...testPortfolio(), freeSlides: 'nope' }) },
  ]

  for (const [i, command] of malformed.entries()) {
    it(`${i} — ${command.type}`, () => {
      expect(decide(p, command)).toBeUndefined()
    })
  }
})

/**
 * The refusal must not become a gate on the ordinary edit: the values the
 * editor really produces all pass. A contract that refused a legitimate edit
 * would trade one silent loss for another.
 */
describe('the contract lets the ordinary edit through', () => {
  // Erasing an optional is a legitimate edit; every entry here changes
  // something, so a refusal is the contract's doing and not `decide`'s
  // triviality rule.
  const accepted: readonly Command[] = [
    { type: 'ChangeReviewField', field: 'subtitle', after: undefined },
    { type: 'ChangeReviewField', field: 'title', after: '' },
    { type: 'ChangeIdentityField', field: 'contact', after: undefined },
    { type: 'ChangeIdentityField', field: 'logo', after: 'data:image/svg+xml;base64,PHN2Zy8+' },
    { type: 'ChangeSetting', setting: 'fontFaces', after: [face()] },
    { type: 'ChangeSetting', setting: 'recapRows', after: 6 },
    { type: 'ChangeSetting', setting: 'recapRows', after: 16 },
    { type: 'ChangeProjectField', id: 'P-01', field: 'progress', after: undefined },
    { type: 'ChangeProjectField', id: 'P-01', field: 'health', after: undefined },
    { type: 'ChangeProjectField', id: 'P-01', field: 'categoryId', after: forged('') },
    // A real February 29th: the calendar rule accepts the leap year it should.
    { type: 'ChangeProjectField', id: 'P-01', field: 'start', after: isoDate('2028-02-29') },
    { type: 'ChangeProjectList', id: 'P-01', list: 'next', after: [] },
    { type: 'ChangeProjectMilestones', id: 'P-01', after: [] },
    { type: 'ChangeProjectDecisions', id: 'P-01', after: [] },
  ]

  for (const command of accepted) {
    it(`accepts ${command.type} ${'field' in command ? String(command.field) : 'setting' in command ? String(command.setting) : ''}`, () => {
      expect(decide(p, command)).toBeDefined()
    })
  }
})
