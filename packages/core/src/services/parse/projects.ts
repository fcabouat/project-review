/**
 * `projects` collection — the central aggregate and its two row collections
 * (decisions, milestones). Required scalars mirror the non-optional fields of
 * the model; `categoryId` may be `""` (the sanctioned "unassigned" reference,
 * values/ids.ts) but must be present.
 */
import type { Decision, Milestone, Project } from '../../model/project'
import { HEALTH_LEVELS, PRIORITIES, SHEET_MODES, STAGES } from '../../model/project'
import type { CategoryId, ProjectId } from '../../values/ids'
import { progressOf } from '../../values/progress'
import type { Errors } from './json'
import {
  bool,
  checkKeys,
  dateVal,
  enumVal,
  fail,
  idStr,
  list,
  optStr,
  record,
  str,
  strList,
  withinRows,
} from './json'

const REQUIRED = [
  'id',
  'name',
  'categoryId',
  'stage',
  'onHold',
  'goal',
  'done',
  'ongoing',
  'next',
  'decisions',
  'milestones',
  'sheet',
] as const

const OPTIONAL = [
  'priority',
  'health',
  'progress',
  'lead',
  'sponsor',
  'scope',
  'budget',
  'start',
  'targetEnd',
  'actualEnd',
  'risks',
  'updatedOn',
  'author',
] as const

function parseDecisions(x: unknown, path: string, errors: Errors): readonly Decision[] {
  if (!withinRows(x, path, errors)) return []
  const items = list(x, path, errors) ?? []
  const decisions: Decision[] = []
  items.forEach((raw, i) => {
    const p = `${path}[${i}]`
    const o = record(raw, p, errors)
    if (o === undefined) return
    checkKeys(o, p, ['question'], ['decider', 'taken'], errors)
    let taken: Decision['taken']
    if (o['taken'] !== undefined) {
      const t = record(o['taken'], `${p}.taken`, errors)
      if (t !== undefined) {
        checkKeys(t, `${p}.taken`, ['text', 'when'], [], errors)
        const text = str(t['text'], `${p}.taken.text`, errors)
        const when = dateVal(t['when'], `${p}.taken.when`, errors)
        if (text !== undefined && when !== undefined) taken = { text, when }
      }
    }
    decisions.push({
      question: str(o['question'], `${p}.question`, errors) ?? '',
      decider: optStr(o['decider'], `${p}.decider`, errors),
      taken,
    })
  })
  return decisions
}

function parseMilestones(x: unknown, path: string, errors: Errors): readonly Milestone[] {
  if (!withinRows(x, path, errors)) return []
  const items = list(x, path, errors) ?? []
  const milestones: Milestone[] = []
  items.forEach((raw, i) => {
    const p = `${path}[${i}]`
    const o = record(raw, p, errors)
    if (o === undefined) return
    checkKeys(o, p, ['label', 'date', 'done'], ['display'], errors)
    milestones.push({
      label: str(o['label'], `${p}.label`, errors) ?? '',
      date: dateVal(o['date'], `${p}.date`, errors) ?? ('' as Milestone['date']),
      display: optStr(o['display'], `${p}.display`, errors),
      done: bool(o['done'], `${p}.done`, errors) ?? false,
    })
  })
  return milestones
}

/** One narrative list: the row ceiling first, then the strings. */
const narrative = (x: unknown, path: string, errors: Errors): readonly string[] =>
  withinRows(x, path, errors) ? (strList(x, path, errors) ?? []) : []

/** Parses the `projects` collection, collecting every violation. */
export function parseProjects(x: unknown, errors: Errors): readonly Project[] {
  const items = list(x, 'projects', errors) ?? []
  const seen = new Set<string>()
  const projects: Project[] = []
  items.forEach((raw, i) => {
    const path = `projects[${i}]`
    const o = record(raw, path, errors)
    if (o === undefined) return
    checkKeys(o, path, REQUIRED, OPTIONAL, errors)

    // `""` is the sanctioned unassigned reference, so this is NOT idStr.
    const categoryId = str(o['categoryId'], `${path}.categoryId`, errors) ?? ''

    let progress: Project['progress']
    const rawProgress = o['progress']
    if (rawProgress !== undefined) {
      progress = typeof rawProgress === 'number' ? progressOf(rawProgress) : undefined
      if (progress === undefined) {
        fail(errors, `${path}.progress`, 'invalidProgress', { value: String(rawProgress) })
      }
    }

    projects.push({
      id: idStr(o['id'], seen, `${path}.id`, errors) as ProjectId,
      name: str(o['name'], `${path}.name`, errors) ?? '',
      categoryId: categoryId as CategoryId,
      priority: enumVal(o['priority'], PRIORITIES, `${path}.priority`, errors),
      stage: enumVal(o['stage'], STAGES, `${path}.stage`, errors) ?? 'toScope',
      onHold: bool(o['onHold'], `${path}.onHold`, errors) ?? false,
      health: enumVal(o['health'], HEALTH_LEVELS, `${path}.health`, errors),
      progress,
      lead: optStr(o['lead'], `${path}.lead`, errors),
      sponsor: optStr(o['sponsor'], `${path}.sponsor`, errors),
      scope: optStr(o['scope'], `${path}.scope`, errors),
      goal: str(o['goal'], `${path}.goal`, errors) ?? '',
      budget: optStr(o['budget'], `${path}.budget`, errors),
      start: dateVal(o['start'], `${path}.start`, errors),
      targetEnd: dateVal(o['targetEnd'], `${path}.targetEnd`, errors),
      actualEnd: dateVal(o['actualEnd'], `${path}.actualEnd`, errors),
      done: narrative(o['done'], `${path}.done`, errors),
      ongoing: narrative(o['ongoing'], `${path}.ongoing`, errors),
      next: narrative(o['next'], `${path}.next`, errors),
      risks: optStr(o['risks'], `${path}.risks`, errors),
      decisions: parseDecisions(o['decisions'], `${path}.decisions`, errors),
      milestones: parseMilestones(o['milestones'], `${path}.milestones`, errors),
      sheet: enumVal(o['sheet'], SHEET_MODES, `${path}.sheet`, errors) ?? 'auto',
      updatedOn: dateVal(o['updatedOn'], `${path}.updatedOn`, errors),
      author: optStr(o['author'], `${path}.author`, errors),
    })
  })
  return projects
}
