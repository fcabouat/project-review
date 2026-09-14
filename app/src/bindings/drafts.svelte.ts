/**
 * Reactive registry of mounted commit callbacks and raw field checkpoints.
 * Checkpoints outlive a field's mounting, so unfinished input can be recovered
 * when its tab or screen is reopened. Storage policy belongs to core.
 */

import { flushSync, untrack } from 'svelte'
import type { DraftRegistry, PendingDraft } from '@project-review/components/editor/drafts'
import type { DraftSnapshot } from '@project-review/core/services/persistence'

/**
 * Builds one registry — one per shell, and the app owns the single instance
 * (it hangs off the persistence wiring, which is what consumes it).
 */
export const createDraftRegistry = (initial: readonly DraftSnapshot[] = []): DraftRegistry => {
  /**
   * The registered fields. REACTIVE, so that `pending` is re-read when the
   * LIST changes and not only when a draft does. Unmounted callbacks must
   * not be read; raw checkpoints are counted independently.
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
  let snapshots = $state.raw(initial)
  let generation = $state(0)

  return {
    get snapshot() {
      return snapshots
    },
    get generation() {
      return generation
    },
    recover: (key, base) => {
      // A reset must resync even fields whose model value did not change.
      void generation
      return untrack(() => snapshots.find((one) => one.key === key && one.base === base)?.value)
    },
    checkpoint: (key, base, value) =>
      untrack(() => {
        const previous = snapshots.find((one) => one.key === key)
        if (value === undefined && previous === undefined) return
        if (value !== undefined && previous?.base === base && previous.value === value) return
        snapshots = snapshots.filter((one) => one.key !== key)
        if (value !== undefined) snapshots = [...snapshots, { key, base, value }]
      }),
    reset: (next = []) =>
      untrack(() => {
        snapshots = next
        generation += 1
      }),
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
      return snapshots.length > 0 || entries.some((one) => one.dirty())
    },
    commitAll: () => {
      // Every field, unconditionally: a field's own commit records only a
      // real change, which is the comparison that cannot be wrong — and the
      // one that does not depend on an effect having flushed since the last
      // keystroke. The caller compares the state before and after.
      for (const one of untrack(() => entries)) one.commit()
      flushSync()
    },
  }
}
