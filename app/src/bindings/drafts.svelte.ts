/**
 * The pending-draft registry — the HOST half of the port the text fields
 * declare (`components/editor/drafts`): the fields of the mounted shell
 * announce what they are holding here, and the persistence asks this two
 * questions — « is anything waiting? », so the save state never reads
 * « saved » over unrecorded input, and « commit everything, now », the first
 * step of the closing write.
 *
 * Reactivity is ALL this module owns. What a draft is, when it differs from
 * the model and what committing one means are the field's (`FieldText`, the
 * milestone rows) — this end holds a list and walks it.
 */

import { untrack } from 'svelte'
import type { DraftRegistry, PendingDraft } from '@project-review/components/editor/drafts'

/**
 * Builds one registry — one per shell, and the app owns the single instance
 * (it hangs off the persistence wiring, which is what consumes it).
 */
export const createDraftRegistry = (): DraftRegistry => {
  /**
   * The registered fields. REACTIVE, so that `pending` is re-read when the
   * LIST changes and not only when a draft does: a field that unmounts
   * mid-edit must stop being counted, or the strip would wait forever on
   * input that went away with it.
   *
   * `$state.raw` and replaced wholesale: the list is walked by `commitAll`
   * while a commit may unmount its own field, and a replaced array is a
   * snapshot by construction.
   *
   * EVERY MUTATION IS UNTRACKED, and that is not a precaution: registering
   * happens inside the field's own mount effect, so a tracked READ of this
   * cell there would make that effect depend on the very list it appends to —
   * every field mounting would tear down and re-register every other.
   */
  let entries = $state.raw<readonly PendingDraft[]>([])

  return {
    register: (draft) => {
      untrack(() => {
        entries = [...entries, draft]
      })
      return () =>
        untrack(() => {
          entries = entries.filter((one) => one !== draft)
        })
    },
    get pending() {
      // Reading each `dirty()` is what subscribes the caller to the fields'
      // own drafts: the strip re-reads this on the keystroke that creates one
      // and on the blur that records it.
      return entries.some((one) => one.dirty())
    },
    commitAll: () => {
      // Every field, unconditionally: a field's own commit records only a
      // real change, which is the comparison that cannot be wrong — and the
      // one that does not depend on an effect having flushed since the last
      // keystroke. The caller compares the state before and after.
      for (const one of untrack(() => entries)) one.commit()
    },
  }
}
