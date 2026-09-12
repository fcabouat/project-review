/**
 * DECODING A STORED EVENT — the door the undo/redo log comes through, and the
 * reason it exists: the events in the browser's storage are ORDINARY TEXT.
 * Anyone can hand-edit them, a half-written save can truncate them, an older
 * build can have written a shape this one no longer knows. Reaching `invert`
 * or `apply` with one of those is not a refused undo, it is a `TypeError` in
 * the middle of the edit loop — `invert` reads `e.after.id` on a
 * `FreeSlideChanged`, `mergeReport` reads `e.before.projects.length`, and
 * neither has any business checking first: the events they receive are typed.
 *
 * So the check happens HERE, once, at the boundary, and it is a DECODER, not a
 * guard: unknown in, a `DomainEvent` or nothing out.
 *
 * THE SHAPE OF THE CHECK. One case per variant, and each case states the
 * variant's EXACT KEY SET — required keys present, no key the variant does not
 * own. Two pins keep it honest as the union grows: {@link EVENT_TYPES} is
 * `CoversExactly`-pinned to `DomainEvent['type']`, and the switch below ends
 * on a `never` sentinel. A variant added without a case fails the build twice.
 *
 * A key whose value is `undefined` is an ABSENT key, not a present one: JSON
 * drops it on the way out (`withField` removes it in the first place), so the
 * four field-carrying variants declare `before`/`after` OPTIONAL and let the
 * aggregate judge whether that field tolerates absence.
 *
 * VALUES ARE JUDGED BY THE ONE CONTRACT. Nothing here restates what a project
 * or a date is: the payload is written onto a neutral PROBE aggregate — the
 * same `withField` `apply` uses, the same `apply` for the flattened settings —
 * and the whole result goes through `model/contract.ts`. A value the file
 * format would refuse is a value this decoder refuses, by construction and
 * without a second list of rules to keep in step.
 *
 * WHAT IT DOES NOT DO. It does not repair, and it does not refuse the
 * document: {@link decodeHistory} drops a faulty log in silence, because the
 * portfolio that travelled in the same envelope is perfectly good and losing
 * undo steps is not losing the work (see `readStored`).
 *
 * PURE module: model + values + events, no clock, no mutation.
 */
import type { IsoDate } from '../values/date'
import { isoDate } from '../values/date'
import type { CoversExactly } from '../values/refine'
import type { CategoryId, ProjectId } from '../values/ids'
import { COLORS } from '../model/category'
import type { Portfolio } from '../model/portfolio'
import type { Project } from '../model/project'
import {
  isDenseList,
  isId,
  isPosition,
  isRecord,
  isText,
  isTextList,
  oneOf,
  validCategory,
  validDecision,
  validFreeSlide,
  validIdentity,
  validMilestone,
  validPortfolio,
  validProject,
  validReview,
  validSettings,
  withinRows,
} from '../model/contract'
import type { DomainEvent, SettingChanged } from '../events'
import { IDENTITY_FIELDS, NARRATIVE_LISTS, PROJECT_SCALAR_FIELDS, REVIEW_FIELDS } from '../events'
import { SETTING_KEYS } from '../events'
import { apply, withField } from '../events'
import { emptyHistory, type History } from '../events/history'

/* -------------------------------- the pins ------------------------------- */

/**
 * Runtime mirror of `DomainEvent['type']`. The sentinel under it pins the two
 * together: a variant added to the union without a name here is a compile
 * error, and so is a name here that no variant carries.
 */
const EVENT_TYPES = [
  'ReviewFieldChanged',
  'IdentityFieldChanged',
  'SettingChanged',
  'CategoryCreated',
  'CategoryDeleted',
  'CategoryRenamed',
  'CategoryRecolored',
  'CategoryMoved',
  'ProjectCreated',
  'ProjectDeleted',
  'ProjectMoved',
  'ProjectRenumbered',
  'ProjectFieldChanged',
  'ProjectListChanged',
  'ProjectMilestonesChanged',
  'ProjectDecisionsChanged',
  'FreeSlideCreated',
  'FreeSlideDeleted',
  'FreeSlideChanged',
  'FreeSlideMoved',
  'PortfolioReplaced',
  'ProjectsMerged',
] as const satisfies readonly DomainEvent['type'][]

const _everyVariantDecoded: CoversExactly<(typeof EVENT_TYPES)[number], DomainEvent['type']> = true

/* ----------------------------- the vocabulary ---------------------------- */

/**
 * The variant's exact key set: every `required` key present, and no key beyond
 * `required ∪ optional`. Same discipline as the parse's `checkKeys`, and the
 * reason `{"type":"FreeSlideChanged"}` never reaches `invert`.
 */
const keys = (
  o: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean =>
  required.every((k) => k in o) &&
  Object.keys(o).every((k) => required.includes(k) || optional.includes(k))

/** `before` and `after` of a field-carrying variant: both optional, because an
 * optional field whose value is absent loses its key in the serialisation. */
const SIDES = ['before', 'after'] as const

/* --------------------------------- probes -------------------------------- */

/**
 * The neutral aggregates a judged value is written onto. They exist so that
 * ONE rule set judges every payload: rather than ask "is this a valid
 * `Project['stage']`", the decoder writes the value into a project that is
 * otherwise beyond reproach and asks whether the project is still valid — the
 * question `commands/contract.ts` asks of a command, and the question the
 * parse asks of a file. Anything that fails is the injected value.
 */
const PROBE_DATE = isoDate('2000-01-01') as IsoDate

const PROBE_PROJECT: Project = {
  id: 'probe' as ProjectId,
  name: '',
  categoryId: '' as CategoryId,
  stage: 'toScope',
  onHold: false,
  goal: '',
  done: [],
  ongoing: [],
  next: [],
  decisions: [],
  milestones: [],
  sheet: 'auto',
}

const PROBE: Portfolio = {
  version: 3,
  review: { title: '', reviewDate: PROBE_DATE },
  settings: {
    language: 'en',
    identity: { org: '', unit: '' },
    theme: { style: 'flat', palette: 'material', font: 'Roboto' },
    show: { healthDashboard: true, recap: true, archives: true, decisions: true },
    recapRows: 11,
  },
  categories: [],
  projects: [],
  freeSlides: [],
}

/** Both sides of a `ReviewFieldChanged`, judged on a probe review. */
const soundReviewSides = (o: Record<string, unknown>, field: never): boolean =>
  SIDES.every((side) => validReview(withField(PROBE.review, field, o[side] as never)))

/** Both sides of an `IdentityFieldChanged`, judged on a probe identity. */
const soundIdentitySides = (o: Record<string, unknown>, field: never): boolean =>
  SIDES.every((side) => validIdentity(withField(PROBE.settings.identity, field, o[side] as never)))

/** Both sides of a `ProjectFieldChanged`, judged on a probe project. */
const soundProjectSides = (o: Record<string, unknown>, field: never): boolean =>
  SIDES.every((side) => validProject(withField(PROBE_PROJECT, field, o[side] as never)))

/**
 * Both sides of a `SettingChanged`, judged through `apply` itself: the
 * flattened setting names have no aggregate of their own, and `apply` is the
 * one place that knows where each of them lands in `Settings`. Writing the
 * value with the very function that would store it is the whole point.
 */
const soundSettingSides = (o: Record<string, unknown>, setting: string): boolean =>
  SIDES.every((side) => {
    const written = { type: 'SettingChanged', setting, before: o[side], after: o[side] }
    return validSettings(apply(PROBE, written as unknown as SettingChanged).settings)
  })

/** One side of a `ProjectsMerged`: two positioned collections, each element a
 * complete aggregate pinned to a whole index. */
const soundSlice = (x: unknown): boolean => {
  if (!isRecord(x) || !keys(x, ['projects', 'categories'])) return false
  const positioned = (list: unknown, valid: (value: never) => boolean): boolean =>
    isDenseList(list) &&
    list.every(
      (entry: unknown) =>
        isRecord(entry) &&
        keys(entry, ['value', 'index']) &&
        isPosition(entry['index']) &&
        isRecord(entry['value']) &&
        valid(entry['value'] as never),
    )
  return positioned(x['projects'], validProject) && positioned(x['categories'], validCategory)
}

/* -------------------------------- the door ------------------------------- */

/**
 * One stored event, or `undefined`. Total over ANY input — a string, a null, a
 * variant this build does not know, a variant it knows with a field missing.
 * The returned value is the input object itself: nothing is rebuilt, so the
 * event replays exactly as it was stored.
 */
export const decodeEvent = (value: unknown): DomainEvent | undefined => {
  if (!isRecord(value)) return undefined
  const type = value['type']
  if (!isText(type) || !(EVENT_TYPES as readonly string[]).includes(type)) return undefined
  return soundVariant(value, type as DomainEvent['type'])
    ? (value as unknown as DomainEvent)
    : undefined
}

/** The exhaustive per-variant check — see the module header for the two pins. */
const soundVariant = (o: Record<string, unknown>, type: DomainEvent['type']): boolean => {
  switch (type) {
    case 'ReviewFieldChanged':
      return (
        keys(o, ['type', 'field'], [...SIDES]) &&
        oneOf(o['field'], REVIEW_FIELDS) &&
        soundReviewSides(o, o['field'] as never)
      )

    case 'IdentityFieldChanged':
      return (
        keys(o, ['type', 'field'], [...SIDES]) &&
        oneOf(o['field'], IDENTITY_FIELDS) &&
        soundIdentitySides(o, o['field'] as never)
      )

    case 'SettingChanged':
      return (
        keys(o, ['type', 'setting'], [...SIDES]) &&
        oneOf(o['setting'], SETTING_KEYS) &&
        soundSettingSides(o, o['setting'] as string)
      )

    case 'CategoryCreated':
    case 'CategoryDeleted':
      return (
        keys(o, ['type', 'category', 'index']) &&
        isPosition(o['index']) &&
        isRecord(o['category']) &&
        validCategory(o['category'] as never)
      )

    case 'CategoryRenamed':
      return keys(o, ['type', 'id', ...SIDES]) && isId(o['id']) && SIDES.every((s) => isText(o[s]))

    case 'CategoryRecolored':
      return (
        keys(o, ['type', 'id', ...SIDES]) &&
        isId(o['id']) &&
        SIDES.every((s) => oneOf(o[s], COLORS))
      )

    case 'CategoryMoved':
    case 'ProjectMoved':
    case 'FreeSlideMoved':
      return (
        keys(o, ['type', 'id', 'from', 'to']) &&
        isId(o['id']) &&
        isPosition(o['from']) &&
        isPosition(o['to'])
      )

    case 'ProjectCreated':
    case 'ProjectDeleted':
      return (
        keys(o, ['type', 'project', 'index']) &&
        isPosition(o['index']) &&
        isRecord(o['project']) &&
        validProject(o['project'] as never)
      )

    case 'ProjectRenumbered':
      return keys(o, ['type', 'oldId', 'newId']) && isId(o['oldId']) && isId(o['newId'])

    case 'ProjectFieldChanged':
      return (
        keys(o, ['type', 'id', 'field'], [...SIDES]) &&
        isId(o['id']) &&
        oneOf(o['field'], PROJECT_SCALAR_FIELDS) &&
        soundProjectSides(o, o['field'] as never)
      )

    // THE THREE LIST VARIANTS, AND THE BOUND THEY USED TO MISS. Each side is a
    // whole collection the event installs verbatim, so the row ceiling
    // (`withinRows`, the memory-safety budget) is as much a part of the
    // contract as the shape of one element — `validProject` states it for the
    // same three lists when a project is judged whole, and the parse states it
    // on the way in. Stated only per element, a stored event could hand a
    // project a million rows: under the entity count, over the byte cap, and
    // discovered at the next reload.
    case 'ProjectListChanged':
      return (
        keys(o, ['type', 'id', 'list', ...SIDES]) &&
        isId(o['id']) &&
        oneOf(o['list'], NARRATIVE_LISTS) &&
        SIDES.every((s) => withinRows(o[s]) && isTextList(o[s]))
      )

    case 'ProjectMilestonesChanged':
      return (
        keys(o, ['type', 'id', ...SIDES]) &&
        isId(o['id']) &&
        SIDES.every((s) => withinRows(o[s]) && (o[s] as unknown[]).every(validMilestone as never))
      )

    case 'ProjectDecisionsChanged':
      return (
        keys(o, ['type', 'id', ...SIDES]) &&
        isId(o['id']) &&
        SIDES.every((s) => withinRows(o[s]) && (o[s] as unknown[]).every(validDecision as never))
      )

    case 'FreeSlideCreated':
    case 'FreeSlideDeleted':
      return (
        keys(o, ['type', 'slide', 'index']) &&
        isPosition(o['index']) &&
        isRecord(o['slide']) &&
        validFreeSlide(o['slide'] as never)
      )

    // `invert` routes on the ARRIVAL id (`e.after.id`), which is precisely the
    // read that used to crash on a payload-less event.
    case 'FreeSlideChanged':
      return (
        keys(o, ['type', 'id', ...SIDES]) &&
        isId(o['id']) &&
        SIDES.every((s) => isRecord(o[s]) && validFreeSlide(o[s] as never))
      )

    // Both sides are WHOLE portfolios `apply`/`invert` install verbatim: they
    // answer the same contract an imported file answers.
    case 'PortfolioReplaced':
      return (
        keys(o, ['type', ...SIDES]) &&
        SIDES.every((s) => isRecord(o[s]) && validPortfolio(o[s] as never))
      )

    case 'ProjectsMerged':
      return keys(o, ['type', ...SIDES]) && SIDES.every((s) => soundSlice(o[s]))
  }
  // Exhaustiveness sentinel — a variant added without a case fails here.
  /* v8 ignore start */
  const _unreachable: never = type
  return false
  /* v8 ignore stop */
}

/**
 * The undo/redo log an envelope carries, or `emptyHistory` when ANY part of it
 * fails to decode. All-or-nothing on purpose: a log is a sequence, and
 * replaying the half of it that survived would undo steps in an order nobody
 * recorded. Dropped IN SILENCE — the portfolio in the same envelope has just
 * passed the strict parse and is perfectly good; losing undo steps is not
 * losing the document.
 */
export const decodeHistory = (value: unknown): History => {
  if (!isRecord(value)) return emptyHistory
  const past = decodeEventList(value['past'])
  const future = decodeEventList(value['future'])
  if (past === undefined || future === undefined) return emptyHistory
  return { past, future }
}

/** A whole stack, or `undefined` the moment one event fails to decode. */
const decodeEventList = (value: unknown): readonly DomainEvent[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const events: DomainEvent[] = []
  for (const raw of value) {
    const event = decodeEvent(raw)
    if (event === undefined) return undefined
    events.push(event)
  }
  return events
}
