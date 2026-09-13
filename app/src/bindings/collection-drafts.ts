import type { DomainEvent } from '@project-review/core/events'
import type { DraftSnapshot } from '@project-review/core/services/persistence'
import { outcomeDraft } from '@project-review/components/editor/decision-outcome'

type CollectionEvent = Extract<
  DomainEvent,
  { type: 'ProjectMilestonesChanged' | 'ProjectDecisionsChanged' }
>

/** Follow surviving positional rows; never invalidate unrelated project fields. */
export function remapCollectionDrafts(
  drafts: readonly DraftSnapshot[],
  event: CollectionEvent,
): readonly DraftSnapshot[] {
  const used = new Set<number>()
  const from = event.after.map((row) => {
    // Identity disambiguates identical rows during live edits. Stored history
    // has separate objects: fall back to equal values, consuming each once.
    let index = event.before.findIndex((old, i) => !used.has(i) && old === row)
    if (index < 0)
      index = event.before.findIndex(
        (old, i) => !used.has(i) && JSON.stringify(old) === JSON.stringify(row),
      )
    if (index >= 0) used.add(index)
    return index
  })
  const collection = event.type === 'ProjectMilestonesChanged' ? 'milestone' : 'decision'
  const prefix = JSON.stringify(['project', event.id, collection]).slice(0, -1) + ','
  const outcomeKey = JSON.stringify(['project', event.id, 'outcomes'])
  return drafts.flatMap((draft): DraftSnapshot[] => {
    if (event.type === 'ProjectDecisionsChanged' && draft.key === outcomeKey) {
      // Incomplete decision outcomes have an aggregate checkpoint as well as
      // individual field checkpoints. Rebase both on the surviving rows.
      if (draft.base !== JSON.stringify(event.before)) return []
      try {
        const raw: unknown = JSON.parse(draft.value)
        if (!Array.isArray(raw) || raw.length !== event.before.length) return []
        return [
          {
            ...draft,
            base: JSON.stringify(event.after),
            value: JSON.stringify(
              event.after.map((row, i) => (from[i]! < 0 ? outcomeDraft(row.taken) : raw[from[i]!])),
            ),
          },
        ]
      } catch {
        return []
      }
    }
    if (!draft.key.startsWith(prefix)) return [draft]
    try {
      const key: unknown = JSON.parse(draft.key)
      if (!Array.isArray(key) || !Number.isInteger(key[3]) || key[3] < 0) return []
      const next = from.indexOf(key[3])
      if (next < 0) return [] // Only a removed row loses its checkpoint.
      return [{ ...draft, key: JSON.stringify([...key.slice(0, 3), next, ...key.slice(4)]) }]
    } catch {
      return []
    }
  })
}
