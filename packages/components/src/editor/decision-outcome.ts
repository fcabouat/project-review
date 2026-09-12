import type { DecisionOutcome } from '@project-review/core/model/project'
import { isoDate } from '@project-review/core/values/date'

/** The two editable halves stay outside the domain until they form one outcome. */
export interface OutcomeDraft {
  readonly text: string
  readonly when: string
}

export const outcomeDraft = (taken: DecisionOutcome | undefined): OutcomeDraft => ({
  text: taken?.text ?? '',
  when: taken?.when ?? '',
})

export const matchesOutcome = (draft: OutcomeDraft, taken: DecisionOutcome | undefined): boolean =>
  draft.text === (taken?.text ?? '') && draft.when === (taken?.when ?? '')

export type OutcomeReading =
  | { readonly ok: true; readonly taken: DecisionOutcome | undefined }
  | { readonly ok: false; readonly reason: 'incomplete' | 'invalidDate' }

/** Clearing both fields unsets the outcome; a half-filled result stays a draft. */
export function readOutcomeDraft(draft: OutcomeDraft): OutcomeReading {
  if (draft.text === '' && draft.when === '') return { ok: true, taken: undefined }
  const when = isoDate(draft.when)
  if (draft.when !== '' && when === undefined) return { ok: false, reason: 'invalidDate' }
  if (draft.text === '' || when === undefined) return { ok: false, reason: 'incomplete' }
  return { ok: true, taken: { text: draft.text, when } }
}
