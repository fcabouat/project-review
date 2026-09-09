/**
 * WHY THIS FIXTURE. One table of event samples, EXHAUSTIVE over the
 * `DomainEvent` union: the invertibility law is only worth proving if every
 * variant is on the bench. The table is typed
 * `{ [T in DomainEvent['type']]: … }`, so adding a variant to the union
 * without sampling it does not compile — exhaustiveness is not left to watch.
 *
 * The samples are correlated with `testPortfolio()`: every `before` is what
 * that portfolio actually holds, every scalar family covers change AND erasure
 * on P-01 (which carries every optional) and appearance on P-02 (which
 * carries none) — the two bounds an optional field can cross.
 */

import type { Project } from '../../src/model/project'
import { categoryId, freeSlideId, projectId } from '../../src/values/ids'
import { isoDate } from '../../src/values/date'
import { progressOf } from '../../src/values/progress'
import {
  settingValue,
  REVIEW_FIELDS,
  IDENTITY_FIELDS,
  PROJECT_SCALAR_FIELDS,
  SETTING_KEYS,
  NARRATIVE_LISTS,
  type ProjectScalarField,
  type DomainEvent,
  type ProjectFieldChanged,
  type ReviewFieldChanged,
  type IdentityFieldChanged,
  type SettingChanged,
  type SettingValues,
} from '../../src/events/index'
import {
  MERGED_P02,
  NEW_CATEGORY,
  NEW_PROJECT,
  NEW_SLIDE,
  categoryOf,
  otherPortfolio,
  projectOf,
  slideOf,
  testPortfolio,
} from './hand-built-portfolios'

const d = (x: string) => isoDate(x)!
const cid = (x: string) => categoryId(x)!
const pid = (x: string) => projectId(x)!
const fid = (x: string) => freeSlideId(x)!

/** The portfolio every sample's `before` is read from. */
const p = testPortfolio()

/** One arrival value per scalar field, distinct from the fixture's — a sample
 * whose `after` equalled the `before` would prove inversion vacuously. */
const NEW_VALUES = {
  name: 'Nom remanié',
  categoryId: cid('poste'),
  priority: 'P3',
  stage: 'closed',
  onHold: true,
  health: 'critical',
  progress: progressOf(42)!,
  lead: 'Alex MARTIN',
  sponsor: 'Secrétariat général',
  scope: 'Périmètre élargi',
  goal: 'Objectif reformulé.',
  budget: '12 k€',
  start: d('2026-02-01'),
  targetEnd: d('2027-03-31'),
  actualEnd: d('2026-12-15'),
  risks: 'Nouveau point d’attention.',
  sheet: 'never',
  updatedOn: d('2026-09-01'),
  author: 'Bob DUPONT',
} as const satisfies { readonly [F in ProjectScalarField]: Project[F] }

const NEW_SETTINGS = {
  language: 'en',
  style: 'classic',
  palette: 'material',
  font: 'Marianne',
  healthDashboard: false,
  recap: false,
  archives: false,
  decisions: false,
  recapRows: 6,
} as const satisfies SettingValues

/*
 * The factories below assert their result: the field ↔ value-type correlation
 * is guaranteed by the `NEW_VALUES` / `NEW_SETTINGS` tables (themselves
 * checked by `satisfies`), but inference cannot rebuild it while scanning a
 * correlated union.
 */

/**
 * Optional fields = those a minimal element does not carry. Deducing them from
 * the fixture avoids copying the list of `?` from the model here — the fixture
 * cannot drift from the type it is built against.
 */
const ERASABLE_PROJECT_FIELDS = PROJECT_SCALAR_FIELDS.filter(
  (field) => !(field in projectOf(testPortfolio(), 'P-02')),
)
const ERASABLE_REVIEW_FIELDS = REVIEW_FIELDS.filter((field) => !(field in otherPortfolio().review))
const ERASABLE_IDENTITY_FIELDS = IDENTITY_FIELDS.filter(
  (field) => !(field in otherPortfolio().settings.identity),
)

const projectFields = (
  id: string,
  fields: readonly ProjectScalarField[],
  value: 'new' | 'erased',
): readonly ProjectFieldChanged[] =>
  fields.map(
    (field) =>
      ({
        type: 'ProjectFieldChanged',
        id,
        field,
        before: projectOf(p, id)[field],
        after: value === 'new' ? NEW_VALUES[field] : undefined,
      }) as ProjectFieldChanged,
  )

const reviewFields = (
  fields: readonly (typeof REVIEW_FIELDS)[number][],
  value: 'new' | 'erased',
): readonly ReviewFieldChanged[] =>
  fields.map(
    (field) =>
      ({
        type: 'ReviewFieldChanged',
        field,
        before: p.review[field],
        after: value === 'new' ? `${field} remanié` : undefined,
      }) as ReviewFieldChanged,
  )

const identityFields = (
  fields: readonly (typeof IDENTITY_FIELDS)[number][],
  value: 'new' | 'erased',
): readonly IdentityFieldChanged[] =>
  fields.map(
    (field) =>
      ({
        type: 'IdentityFieldChanged',
        field,
        before: p.settings.identity[field],
        after: value === 'new' ? `${field} remanié` : undefined,
      }) as IdentityFieldChanged,
  )

const settings = (): readonly SettingChanged[] =>
  SETTING_KEYS.map(
    (setting) =>
      ({
        type: 'SettingChanged',
        setting,
        before: settingValue(p.settings, setting),
        after: NEW_SETTINGS[setting],
      }) as SettingChanged,
  )

export type EventSamples = {
  readonly [T in DomainEvent['type']]: readonly Extract<DomainEvent, { readonly type: T }>[]
}

export const EVENT_SAMPLES: EventSamples = {
  // Review: every field changed, then every optional one erased.
  ReviewFieldChanged: [
    ...reviewFields(REVIEW_FIELDS, 'new'),
    ...reviewFields(ERASABLE_REVIEW_FIELDS, 'erased'),
  ],

  // Identity (settings side): every field changed, then every optional one erased.
  IdentityFieldChanged: [
    ...identityFields(IDENTITY_FIELDS, 'new'),
    ...identityFields(ERASABLE_IDENTITY_FIELDS, 'erased'),
  ],

  // Settings: closed path, one variant per setting.
  SettingChanged: settings(),

  CategoryCreated: [
    { type: 'CategoryCreated', category: NEW_CATEGORY, index: 0 },
    // Out-of-range index: clamped (see 'apply is total'), and the inverse
    // still finds the category.
    { type: 'CategoryCreated', category: NEW_CATEGORY, index: 99 },
  ],
  CategoryDeleted: [
    { type: 'CategoryDeleted', category: categoryOf(p, 'infra'), index: 0 },
    { type: 'CategoryDeleted', category: categoryOf(p, 'poste'), index: 1 },
  ],
  CategoryRenamed: [
    { type: 'CategoryRenamed', id: 'infra', before: 'Infrastructure', after: 'Socle technique' },
  ],
  CategoryRecolored: [{ type: 'CategoryRecolored', id: 'poste', before: 'green', after: 'orange' }],
  CategoryMoved: [
    { type: 'CategoryMoved', id: 'infra', from: 0, to: 1 },
    { type: 'CategoryMoved', id: 'poste', from: 1, to: 0 },
  ],

  ProjectCreated: [
    { type: 'ProjectCreated', project: NEW_PROJECT, index: 0 },
    { type: 'ProjectCreated', project: NEW_PROJECT, index: 3 },
  ],
  ProjectDeleted: [
    { type: 'ProjectDeleted', project: projectOf(p, 'P-01'), index: 0 },
    { type: 'ProjectDeleted', project: projectOf(p, 'P-03'), index: 2 },
  ],
  ProjectMoved: [
    { type: 'ProjectMoved', id: 'P-01', from: 0, to: 2 },
    { type: 'ProjectMoved', id: 'P-03', from: 2, to: 0 },
  ],
  ProjectRenumbered: [{ type: 'ProjectRenumbered', oldId: pid('P-01'), newId: pid('P-99') }],

  // Scalar fields: P-01 carries them all (change then erasure),
  // P-02 carries none (appearance of an absent optional).
  ProjectFieldChanged: [
    ...projectFields('P-01', PROJECT_SCALAR_FIELDS, 'new'),
    ...projectFields('P-01', ERASABLE_PROJECT_FIELDS, 'erased'),
    ...projectFields('P-02', PROJECT_SCALAR_FIELDS, 'new'),
  ],

  ProjectListChanged: [
    ...NARRATIVE_LISTS.map(
      (list) =>
        ({
          type: 'ProjectListChanged',
          id: 'P-01',
          list,
          before: projectOf(p, 'P-01')[list],
          after: ['puce remaniée', 'seconde puce'],
        }) as const,
    ),
    ...NARRATIVE_LISTS.map(
      (list) =>
        ({
          type: 'ProjectListChanged',
          id: 'P-02',
          list,
          before: projectOf(p, 'P-02')[list],
          after: ['première puce'],
        }) as const,
    ),
  ],

  ProjectMilestonesChanged: [
    {
      type: 'ProjectMilestonesChanged',
      id: 'P-01',
      before: projectOf(p, 'P-01').milestones,
      after: [],
    },
    {
      type: 'ProjectMilestonesChanged',
      id: 'P-02',
      before: projectOf(p, 'P-02').milestones,
      after: [{ label: 'Cadrage validé', date: d('2026-10-01'), done: false }],
    },
  ],

  ProjectDecisionsChanged: [
    {
      type: 'ProjectDecisionsChanged',
      id: 'P-01',
      before: projectOf(p, 'P-01').decisions,
      after: [{ question: 'Question unique ?' }],
    },
    {
      type: 'ProjectDecisionsChanged',
      id: 'P-02',
      before: projectOf(p, 'P-02').decisions,
      after: [
        { question: 'Arbitrer le calendrier ?', decider: 'Direction' },
        { question: 'Reporter ?', taken: { text: 'Reporté à 2027', when: d('2026-09-03') } },
      ],
    },
  ],

  FreeSlideCreated: [
    { type: 'FreeSlideCreated', slide: NEW_SLIDE, index: 0 },
    { type: 'FreeSlideCreated', slide: NEW_SLIDE, index: 1 },
  ],
  FreeSlideDeleted: [{ type: 'FreeSlideDeleted', slide: slideOf(p, 'opening'), index: 0 }],
  FreeSlideChanged: [
    {
      type: 'FreeSlideChanged',
      id: 'opening',
      before: slideOf(p, 'opening'),
      after: { ...slideOf(p, 'opening'), title: 'Ouverture remaniée', blocks: [['A']] },
    },
    // Anchor change.
    {
      type: 'FreeSlideChanged',
      id: 'opening',
      before: slideOf(p, 'opening'),
      after: {
        ...slideOf(p, 'opening'),
        anchor: { type: 'beforeCategory', categoryId: cid('infra') },
      },
    },
    // Re-identification: the inverse routes on the arrival id.
    {
      type: 'FreeSlideChanged',
      id: 'opening',
      before: slideOf(p, 'opening'),
      after: { ...slideOf(p, 'opening'), id: fid('opening-2') },
    },
  ],
  FreeSlideMoved: [{ type: 'FreeSlideMoved', id: 'opening', from: 0, to: 0 }],

  PortfolioReplaced: [{ type: 'PortfolioReplaced', before: p, after: otherPortfolio() }],

  ProjectsMerged: [
    // Full shape: P-02 replaced in place, P-99 appended at the end of its
    // category ('poste' → final index 2), the concerned category 'poste'
    // identical on both sides (the present won), a new category appended.
    {
      type: 'ProjectsMerged',
      before: {
        projects: [{ value: projectOf(p, 'P-02'), index: 1 }],
        categories: [{ value: categoryOf(p, 'poste'), index: 1 }],
      },
      after: {
        projects: [
          { value: MERGED_P02, index: 1 },
          { value: NEW_PROJECT, index: 2 },
        ],
        categories: [
          { value: categoryOf(p, 'poste'), index: 1 },
          { value: NEW_CATEGORY, index: 2 },
        ],
      },
    },
    // Pure addition: nothing replaced, no category concerned — the low bound.
    {
      type: 'ProjectsMerged',
      before: { projects: [], categories: [] },
      after: { projects: [{ value: NEW_PROJECT, index: 2 }], categories: [] },
    },
    // Out-of-range arrival index: `replaceSlice` clamps the insertion (apply
    // stays total) and the inverse still removes by ID — the round-trip law
    // must hold on the clamped event too.
    {
      type: 'ProjectsMerged',
      before: { projects: [], categories: [] },
      after: { projects: [{ value: NEW_PROJECT, index: 99 }], categories: [] },
    },
  ],
}
