/**
 * PENDING INPUT — the contract between a field that holds a draft and the host
 * that saves.
 *
 * ONE FIELD ↔ ONE EVENT, AT BLUR (`FieldText`) is what keeps the history a
 * list of intentions rather than a list of letters. The price of that rule is
 * a window in which what a person typed exists in the field ALONE, and two
 * consequences follow — both of them the host's business, neither of them
 * something a field can honour on its own:
 *  - the save state must not read « saved » while such a draft differs from
 *    the model. The model really is saved; the sentence is still false about
 *    the person's work;
 *  - the page can go away at any moment, and a blur that never happened
 *    records nothing. The closing path must therefore COMMIT the drafts and
 *    write the state that results, in one synchronous turn — a commit followed
 *    by a save an effect was supposed to schedule is a save that never runs.
 * Both are pinned in `app/tests/bindings/persistence-control.test.ts` («the
 * strip says something is waiting, where it would have said « saved »», «the
 * closing page commits what is typed, then writes the state that results»)
 * and both are exercised end to end by the built deliverable's smoke run (its
 * «mid-edit» checks, on the title, a milestone row and the reload after).
 *
 * Registering is what makes the two possible, and nothing else about the field
 * changes: the draft, the character counter and the blur rule stay exactly
 * where they are.
 *
 * The registry is the HOST's — it lives next to the persistence, which is what
 * consumes it — and reaches the fields through the shell's context
 * (`provideDrafts` / `useDrafts`, declared in `FieldText.svelte`, the field
 * that needs them). A field mounted outside a shell — a story — finds no
 * registry and behaves as it always did.
 */

/** One field's unrecorded input, as the two questions a host can ask of it. */
export interface PendingDraft {
  /**
   * `true` while what is typed differs from what the model holds.
   *
   * IT MUST BE A PLAIN REACTIVE READ, AND NEVER A COMPUTATION OVER THE
   * MOUNTING VIEW'S DATA. The host reads this from the save strip's own
   * render, outside the view that mounted the field — and a field's `value`
   * comes from that view (`project.name`, on the sheet screen), which has
   * nothing to give while it is being torn down. A field therefore compares
   * inside its OWN reactive context and exposes the answer; a `dirty` that
   * re-derived it here would raise the view's error inside the strip, where
   * it aborts the update that was about to remove this very entry.
   */
  readonly dirty: () => boolean
  /**
   * Records what is typed, exactly as leaving the field would — AND ONLY IF
   * IT REALLY CHANGED, because that is what leaving the field does: a
   * focus/blur over an untouched field records nothing and spends no undo
   * step. The host may therefore ask every field without asking first.
   */
  readonly commit: () => void
}

/** Where the fields of one shell announce their drafts. */
export interface DraftRegistry {
  /**
   * Registers one field for the length of its mounting; the call handed back
   * removes it again. A field that unmounts mid-edit stops being counted —
   * its draft is gone with it, and nothing is waiting on it any more.
   */
  readonly register: (draft: PendingDraft) => () => void
  /**
   * `true` while at least one registered field holds input the model has not
   * recorded. An implementation must make this REACTIVE — reading it
   * subscribes to every draft it consults — because the save strip reads it
   * on every keystroke.
   */
  readonly pending: boolean
  /**
   * Asks EVERY registered field to record what it holds, synchronously, and
   * asks unconditionally: each field's own commit is what decides whether
   * anything really changed ({@link PendingDraft.commit}), and that is the
   * comparison that cannot be wrong. The caller reads the state afterwards,
   * in the same turn, and compares it with the state before to learn whether
   * anything moved.
   */
  readonly commitAll: () => void
}
