/** Svelte notifications and host adapters for the framework-free persistence session. */
import { untrack } from 'svelte'
import type {
  KeyValueStorage,
  Scheduler,
  StoredState,
} from '@project-review/core/services/persistence'
import {
  createPersistenceSession,
  type PersistenceSession,
} from '@project-review/core/services/persistence-session'
import type {
  DraftRegistry,
  PersistenceControl,
} from '@project-review/components/screens/contracts'
import { createDraftRegistry } from './drafts.svelte'
import type { Store } from './runtime.svelte'

export interface PersistenceWiring extends Omit<PersistenceSession, 'control'> {
  readonly control: PersistenceControl
  readonly drafts: DraftRegistry
}

export function createPersistenceControl(
  store: Store,
  storage: KeyValueStorage | null,
  initiallyEnabled: boolean,
  schedule: Scheduler,
  stored: StoredState = { state: 'absent' },
): PersistenceWiring {
  let revision = $state(0)
  const drafts = createDraftRegistry(
    initiallyEnabled && stored.state === 'restored' ? stored.drafts : [],
  )
  const session = createPersistenceSession(
    {
      get present() {
        return store.present
      },
      get past() {
        return store.past
      },
      get future() {
        return store.future
      },
      replace: (portfolio) => {
        drafts.reset?.()
        store.dispatch({ type: 'ReplacePortfolio', portfolio })
      },
    },
    storage,
    initiallyEnabled,
    schedule,
    stored,
    drafts,
    () => {
      // scheduleSave is called from an effect: its notification must not make
      // that effect subscribe to the signal it is advancing.
      untrack(() => {
        revision += 1
      })
    },
  )
  const read = <T>(getter: () => T): T => {
    void revision
    return getter()
  }
  // Only changes to the saving permission rerun the host's feeding effect.
  // Status notifications alone must not schedule the state they just saved.
  const canSchedule = $derived(read(() => session.control.enabled && !session.blocked))
  return {
    drafts,
    control: {
      get enabled() {
        return read(() => session.control.enabled)
      },
      get available() {
        return session.control.available
      },
      get save() {
        return read(() => session.control.save)
      },
      get pendingRestore() {
        return read(() => session.control.pendingRestore)
      },
      toggle: session.control.toggle,
      restore: session.control.restore,
      keepOpen: session.control.keepOpen,
      dismissRestore: session.control.dismissRestore,
      takeStored: session.control.takeStored,
      keepMine: session.control.keepMine,
    },
    scheduleSave: (portfolio, history) => {
      void canSchedule
      untrack(() => session.scheduleSave(portfolio, history))
    },
    scheduleDrafts: () => {
      void canSchedule
      void drafts.snapshot
      untrack(() => session.scheduleDrafts())
    },
    checkpoint: session.checkpoint,
    dispose: session.dispose,
    flush: session.flush,
    noticeStoredChange: session.noticeStoredChange,
    get blocked() {
      return read(() => session.blocked)
    },
    get unreadable() {
      return read(() => session.unreadable)
    },
    get discardRefused() {
      return read(() => session.discardRefused)
    },
    discard: session.discard,
  }
}
