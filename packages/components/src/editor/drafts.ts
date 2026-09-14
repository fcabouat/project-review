import type { DraftSnapshot } from '@project-review/core/services/persistence'

/**
 * Field-local raw input is distinct from validated domain events. A blur
 * still creates one undo step; the host checkpoints raw drafts independently.
 * Stable keys and original values let remounted fields recover only matching
 * drafts. Document replacements and structural changes reset obsolete drafts.
 * The registry reaches fields through the shell's context; isolated component
 * stories may omit the checkpoint port.
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

/** Truthful persistence state for one mounted field, when supplied by a host. */
export type FieldSaveState = 'pending' | 'draftSaved' | 'saved'

/** Where the fields of one shell announce their drafts. */
export interface DraftRegistry {
  /** Optional per-field state from the persistence host. */
  readonly getSaveState?: (key: string, dirty: boolean) => FieldSaveState | undefined
  /** Raw checkpoints survive unmounts; fields recover only against their original value. */
  readonly snapshot?: readonly DraftSnapshot[]
  readonly generation?: number
  readonly recover?: (key: string, base: string) => string | undefined
  readonly checkpoint?: (key: string, base: string, value: string | undefined) => void
  /** Explicitly replace the checkpoints and resync mounted fields. */
  readonly reset?: (snapshot?: readonly DraftSnapshot[]) => void
  /**
   * Registers one field for the length of its mounting; the call handed back
   * removes its live callback. A raw checkpoint can outlive that mounting.
   */
  readonly register: (draft: PendingDraft) => () => void
  /**
   * `true` while a live field or a checkpoint holds unvalidated input.
   * An implementation must make this REACTIVE — reading it
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
