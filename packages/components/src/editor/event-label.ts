/**
 * Business wording for a store event — what the History screen reads out loud.
 *
 * Two levels, in this order:
 *  1. THE CATALOG DECIDES. If a key exists for the event (`editor.event.<Type>`
 *     and its variants), that entry produces the whole sentence.
 *  2. OTHERWISE, COMPOSITION. A field change has one label per field and one
 *     per value, so restating 30 sentences would be pure duplication: the
 *     wording is assembled as `P-04 · Santé ▸ Vigilance ▸ Alerte`, where the
 *     subject comes from the aggregate, the field from `editor.field.*` and the
 *     VALUES from the core catalog (`level.alert`, `stage.ready`, …) — the very
 *     labels the slides show, so the history speaks the deck's language.
 *
 * PURE module: no Svelte, no DOM, no clock. Events carry no timestamp (the
 * store's rule): the time shown by the History belongs to the view.
 */
import type { Language } from '@project-review/core/model/theme'
import { displayLabel } from '../commons/display'
import { formatShortDate } from '@project-review/core/services/i18n'
import { isoDate } from '@project-review/core/values/date'
import type {
  DomainEvent,
  IdentityField,
  ProjectScalarField,
  ReviewField,
  SettingKey,
} from '@project-review/core/events'
import { mergeReport } from '@project-review/core/events'
import { hasLabel, te } from '../i18n'

/** Longest value shown inline; beyond that the history becomes unreadable. */
const MAX_VALUE = 40

/**
 * One value of a field, in the language of the deck. Closed scales go through
 * the core catalog; free text is quoted as typed, only shortened.
 */
function formatValue(field: string, value: unknown, language: Language): string {
  if (value === undefined || value === '') return te('editor.value.empty', language)
  const label = (key: string): string => (hasLabel(key) ? te(key, language) : key)

  switch (field) {
    case 'stage':
      return label(`stage.${String(value)}`)
    case 'health':
      return label(`level.${String(value)}`)
    case 'sheet':
      return label(`editor.sheetMode.${String(value)}`)
    case 'palette':
      return label(`editor.palette.${String(value)}`)
    case 'style':
      return label(`editor.style.${String(value)}`)
    case 'logo':
      // A data URI would flood the history: name the change, never the bytes.
      return te('editor.value.image', language)
    case 'fontFaces':
      // Same rule as the logo — the faces are counted, never spelled out.
      return te('editor.value.fontFaces', language, { n: (value as readonly unknown[]).length })
    case 'customPalette':
      // Twelve hex values would flood it too: the palette is named, or counted.
      return (
        (value as { readonly label?: string }).label ?? te('editor.value.customPalette', language)
      )
    case 'language':
      return String(value).toUpperCase()
    case 'progress':
      return te('editor.value.pct', language, { n: String(value) })
    default:
      break
  }

  if (typeof value === 'boolean') {
    return te(value ? 'editor.value.yes' : 'editor.value.no', language)
  }
  const text = String(value)
  const date = isoDate(text)
  if (date !== undefined) return formatShortDate(date)
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1)}…` : text
}

/** `<subject> · <field> : <before> ▸ <after>` — the fallback shape. */
function transition(
  subject: string,
  fieldLabel: string,
  before: string,
  after: string,
  language: Language,
): string {
  // Non-breaking space before the colon in French.
  const colon = language === 'fr' ? ' :' : ':'
  const arrow = te('editor.event.arrow', language)
  return `${subject} · ${fieldLabel}${colon} ${before} ${arrow} ${after}`
}

/** Delta of a list, wired to the three catalog keys of the aggregate. */
function sizeDelta(
  prefix: 'decisions' | 'milestones',
  before: number,
  after: number,
  id: string,
  language: Language,
): string {
  const kind = after > before ? 'Added' : after < before ? 'Removed' : 'Edited'
  return te(`editor.event.${prefix}${kind}`, language, { id })
}

/**
 * Resolves the CURRENT display name of an aggregate the event only knows by id
 * (a recolour, a move). Optional on purpose: without it the label falls back to
 * the id, so the history stays readable even for something since deleted.
 */
export type NameLookup = (kind: 'category' | 'freeSlide', id: string) => string | undefined

/**
 * Business label of an event. TOTAL: an unknown key surfaces as itself rather
 * than throwing — the history must never be the thing that breaks.
 */
export function eventLabel(event: DomainEvent, language: Language, nameOf?: NameLookup): string {
  const byType = `editor.event.${event.type}`
  const named = (kind: 'category' | 'freeSlide', id: string): string => nameOf?.(kind, id) ?? id

  switch (event.type) {
    case 'ReviewFieldChanged': {
      const field: ReviewField = event.field
      return transition(
        te('editor.event.subject.review', language),
        te(`editor.field.${field}`, language),
        formatValue(field, event.before, language),
        formatValue(field, event.after, language),
        language,
      )
    }

    case 'IdentityFieldChanged': {
      const field: IdentityField = event.field
      const fieldLabel =
        field === 'logo'
          ? te('editor.settings.logo', language)
          : te(`editor.field.${field}`, language)
      return transition(
        te('editor.event.subject.identity', language),
        fieldLabel,
        formatValue(field, event.before, language),
        formatValue(field, event.after, language),
        language,
      )
    }

    case 'SettingChanged': {
      const setting: SettingKey = event.setting
      return transition(
        te('editor.event.subject.settings', language),
        te(`editor.setting.${setting}`, language),
        formatValue(setting, event.before, language),
        formatValue(setting, event.after, language),
        language,
      )
    }

    case 'ProjectFieldChanged': {
      const field: ProjectScalarField = event.field
      return transition(
        event.id,
        te(`editor.field.${field}`, language),
        formatValue(field, event.before, language),
        formatValue(field, event.after, language),
        language,
      )
    }

    case 'CategoryCreated':
    case 'CategoryDeleted':
      return te(`editor.event.${event.type}`, language, { name: event.category.name })

    case 'CategoryMoved':
      // Routed by id; the event carries no name (nothing derived is stored).
      return te(`editor.event.${event.type}`, language, { name: named('category', event.id) })

    case 'CategoryRenamed':
      return transition(
        te('editor.event.subject.category', language, { name: event.before }),
        te('editor.field.name', language),
        formatValue('name', event.before, language),
        formatValue('name', event.after, language),
        language,
      )

    case 'CategoryRecolored':
      // Color values are ADT codes ("lightGreen"): the history, like the
      // settings swatches, speaks the catalog's language.
      return transition(
        te('editor.event.subject.category', language, { name: named('category', event.id) }),
        te('editor.settings.color', language),
        te(`editor.color.${event.before}`, language),
        te(`editor.color.${event.after}`, language),
        language,
      )

    case 'ProjectCreated':
    case 'ProjectDeleted':
      return te(`editor.event.${event.type}`, language, { id: event.project.id })

    case 'ProjectMoved':
      return te(`editor.event.${event.type}`, language, { id: event.id })

    case 'ProjectRenumbered':
      return te(`editor.event.${event.type}`, language, { before: event.oldId, after: event.newId })

    case 'ProjectListChanged': {
      // The three narrative lists have their core-catalog label already: `sheet.done`…
      const list = te(`sheet.${event.list}`, language)
      // Equal counts = a bullet was rewritten, not added: "2 ▸ 2" would say nothing.
      const key =
        event.before.length === event.after.length
          ? 'editor.event.listEdited'
          : 'editor.event.listResized'
      return te(key, language, {
        id: event.id,
        list,
        n: event.before.length,
        m: event.after.length,
      })
    }

    case 'ProjectDecisionsChanged':
      return sizeDelta('decisions', event.before.length, event.after.length, event.id, language)

    case 'ProjectMilestonesChanged':
      return sizeDelta('milestones', event.before.length, event.after.length, event.id, language)

    case 'FreeSlideCreated':
    case 'FreeSlideDeleted':
      // An empty title falls back to the display dash — the line stays readable.
      return te(`editor.event.${event.type}`, language, { title: displayLabel(event.slide.title) })

    case 'FreeSlideChanged':
      return te(`editor.event.${event.type}`, language, { title: displayLabel(event.after.title) })

    case 'FreeSlideMoved':
      return te(`editor.event.${event.type}`, language)

    case 'PortfolioReplaced':
      return te(`editor.event.${event.type}`, language, { n: event.after.projects.length })

    case 'ProjectsMerged': {
      // Same figures as the import preview and its report: one derivation
      // (`mergeReport`, core) feeds all three wordings.
      const report = mergeReport(event)
      return te(`editor.event.${event.type}`, language, { n: report.replaced, m: report.added })
    }
  }

  // Exhaustiveness sentinel — the compile-time pin that makes eventLabel the
  // fourth function a new variant must teach (events/index.ts). The fallback
  // under it stays on purpose: totality is ALSO a runtime promise (a rogue
  // event from storage must never break the history screen), and the rogue
  // test walks this very line.
  const _unreachable: never = event
  return hasLabel(byType) ? te(byType, language) : byType
}
