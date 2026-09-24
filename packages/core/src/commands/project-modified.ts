import type { Portfolio } from '../model/portfolio'
import type { DomainEvent } from '../events'
import type { IsoDate } from '../values/date'

/** The host supplies today's date; imports and ordering never rewrite authors' dates. */
export function stampProjectEdit(p: Portfolio, event: DomainEvent, today?: IsoDate): DomainEvent {
  if (today === undefined) return event
  switch (event.type) {
    case 'ProjectCreated':
      return { ...event, project: { ...event.project, updatedOn: today } }
    case 'ProjectsChanged':
      return { ...event, after: event.after.map((project) => ({ ...project, updatedOn: today })) }
    case 'ProjectFieldChanged':
    case 'ProjectListChanged':
    case 'ProjectMilestonesChanged':
    case 'ProjectDecisionsChanged': {
      if (event.type === 'ProjectFieldChanged' && event.field === 'updatedOn') return event
      if (JSON.stringify(event.before) === JSON.stringify(event.after)) return event
      const before = p.projects.find((project) => project.id === event.id)?.updatedOn
      return before === today ? event : { ...event, modified: { before, after: today } }
    }
    default:
      return event
  }
}
