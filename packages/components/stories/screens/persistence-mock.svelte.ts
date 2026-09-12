/**
 * WHY THIS MOCK. Story-local stand-in for the app's persistence control: it
 * flips and it reports, and it never touches a browser storage — with nothing
 * behind it there is never a stored copy to arbitrate.
 *
 * The save state is a plain cell the story seeds, because the two states that
 * MUST be inspectable visually — a write the storage refused, a conflict with
 * another tab — cannot be produced on demand out of a real localStorage. The
 * two conflict answers resolve the state here, so the story stays playable.
 */
import type { PersistenceControl, SaveState } from '../../src/screens/contracts'

export const createPersistenceMock = (
  initial: SaveState = { revision: 1, phase: 'saved' },
  /** `false` reproduces a browser with NO storage: the switch is inert and the
   * strip states the `unavailable` phase for good (seed `initial` with it). */
  available = true,
): PersistenceControl => {
  // `off` is the one phase that IS the switch being off: a mock that read ON
  // beside it would show a pairing the app cannot produce.
  let enabled = $state(initial.phase !== 'off')
  let save = $state<SaveState>(initial)

  /** Both answers end the same way here: the document and the storage agree. */
  const settle = (): void => {
    save = { revision: save.revision + 1, phase: 'saved' }
  }

  return {
    get enabled() {
      return enabled
    },
    get save() {
      // Same rule as the app's wiring: a browser that cannot store says so
      // permanently, and a switch that is off says nothing — unless the off
      // is itself the news (a refused write, a save switched off elsewhere).
      if (!available) return save
      if (!enabled && save.phase !== 'error' && save.phase !== 'off') return undefined
      return save
    },
    toggle: (next: boolean) => {
      if (!available) return
      enabled = next
    },
    available,
    pendingRestore: false,
    restore: () => {},
    keepOpen: () => {},
    dismissRestore: () => {},
    takeStored: settle,
    keepMine: settle,
  }
}
