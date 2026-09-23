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
 * which is exactly what a view needs to react to (e.g. a missing target,
 * or the merge report read off the recorded event).
 */
export type Dispatch = (command: Command) => DomainEvent | undefined

/** Save status has one definition, owned by the persistence session. */
export type { SavePhase, SaveState } from '@project-review/core/services/persistence-session'
