/**
 * Package-wide props vocabulary — the shapes ANY host must provide to the
 * components, screens and editor widgets alike. The screens add their own
 * (Route, PersistenceControl) in `screens/contracts.ts`; `Dispatch` and
 * `SaveState` live here because the editor widgets (FreeSlideCard,
 * ImportExportDialog, SaveStateBar) speak them too, and editor/ may not reach
 * into screens/.
 */

import type { Command } from '@project-review/core/commands'
import type { DomainEvent } from '@project-review/core/events'

/**
 * The one edit channel of every view: a command in, the recorded event out —
 * or `undefined` for a refused/trivial command (see `decide`'s contract),
 * which is exactly what a view needs to react to (e.g. a refused renumbering,
 * or the merge report read off the recorded event).
 */
export type Dispatch = (command: Command) => DomainEvent | undefined

/**
 * Where the open document stands with respect to the copy in the browser's
 * storage. Six states, and the last three are the ones the user must never
 * have to guess at:
 *  - `dirty` — edited since the last write; a save is armed;
 *  - `saving` — the write is happening;
 *  - `saved` — the storage holds this very document;
 *  - `error` — the storage refused the write (quota, private browsing). The
 *    document lives in this tab and NOWHERE else;
 *  - `conflict` — another tab saved over the copy this one was working from.
 *    Nothing was overwritten and nothing will be until a person chooses;
 *  - `unavailable` — this browser offers no storage at all (blocked
 *    third-party storage, a restricted context, `file://` in some browsers).
 *    Not "the save failed this time": nothing will EVER be saved here, so the
 *    switch has nothing to switch and the only honest offer is the same as
 *    `error`'s — take a copy away with you.
 */
export type SavePhase = 'dirty' | 'saving' | 'saved' | 'error' | 'conflict' | 'unavailable'

/**
 * A save verdict and the document revision it is ABOUT — the pair is the
 * point. A write acknowledges the revision it wrote and no other: a success
 * can never wipe the failure of a state it did not carry, and a failure can
 * never survive the successful save of the same one.
 */
export interface SaveState {
  /** Monotone counter of the document in this tab — one per change recorded. */
  readonly revision: number
  readonly phase: SavePhase
}
