/**
 * Pins the pending-draft registry (`src/bindings/drafts.svelte.ts`) — the host
 * half of the port the text fields declare (`components/editor/drafts`). Two
 * questions and one answer each: is anything typed and not recorded, and
 * commit all of it now. The fields themselves are DOM, and the built
 * deliverable's smoke run is what exercises them; what is pinned here is the
 * bookkeeping the persistence depends on.
 */

import { describe, expect, it } from 'vitest'
import type { PendingDraft } from '@project-review/components/editor/drafts'
import { createDraftRegistry } from '../../src/bindings/drafts.svelte'

/**
 * A field stand-in, in the shape a real field registers: what is typed, the
 * answer it publishes, and a commit that records ONLY a real change — which
 * is what leaving a field does, and the reason the registry may ask every
 * field without asking first.
 */
const field = (typed: string, recorded = typed) => {
  const state = { typed, recorded, commits: 0 }
  const draft: PendingDraft = {
    dirty: () => state.typed !== state.recorded,
    commit: () => {
      if (state.typed === state.recorded) return
      state.recorded = state.typed
      state.commits += 1
    },
  }
  return { state, draft }
}

describe('createDraftRegistry', () => {
  it('is empty until a field registers, and says so', () => {
    const registry = createDraftRegistry()
    expect(registry.pending).toBe(false)
    expect(() => registry.commitAll()).not.toThrow()
  })

  it('a registered field that holds nothing new is not pending', () => {
    const registry = createDraftRegistry()
    // What a field looks like on mount: the draft IS the model's value.
    const { state, draft } = field('Revue de mars')
    registry.register(draft)

    expect(registry.pending).toBe(false)
    // Asked all the same, and it records nothing: a focus/blur over an
    // untouched field must not spend an undo step.
    registry.commitAll()
    expect(state.commits).toBe(0)
  })

  it('one field holding unrecorded input makes the whole registry pending', () => {
    const registry = createDraftRegistry()
    const quiet = field('Revue de mars')
    const typing = field('Revue de avr', 'Revue de mars')
    registry.register(quiet.draft)
    registry.register(typing.draft)

    expect(registry.pending).toBe(true)
    registry.commitAll()

    expect(quiet.state.commits).toBe(0)
    expect(typing.state.commits).toBe(1)
    expect(registry.pending).toBe(false)
    // And a second pass records nothing more: there is nothing left to record.
    registry.commitAll()
    expect(typing.state.commits).toBe(1)
  })

  it('a field that unmounts stops being counted, draft and all', () => {
    // The strip would otherwise wait for ever on input that went away with
    // the view holding it — a screen left mid-edit.
    const registry = createDraftRegistry()
    const typing = field('à moitié tapé', '')
    const forget = registry.register(typing.draft)
    expect(registry.pending).toBe(true)

    forget()
    expect(registry.pending).toBe(false)
    registry.commitAll()
    expect(typing.state.commits).toBe(0)
  })

  it('unregistering one field leaves the others exactly where they were', () => {
    const registry = createDraftRegistry()
    const first = field('un', '')
    const second = field('deux', '')
    const forgetFirst = registry.register(first.draft)
    registry.register(second.draft)

    forgetFirst()
    expect(registry.pending).toBe(true)
    registry.commitAll()
    expect(first.state.commits).toBe(0)
    expect(second.state.commits).toBe(1)
  })

  it('a commit that unmounts its own field does not disturb the walk', () => {
    // The realistic case: committing a value re-renders the view that held
    // the field, so the entry is gone before the next one is asked. The walk
    // runs on the list as it stood, and every other field is still committed.
    const registry = createDraftRegistry()
    const other = field('b', '')
    let commits = 0
    const vanishing: PendingDraft = {
      dirty: () => commits === 0,
      commit: () => {
        commits += 1
        forget()
      },
    }
    const forget = registry.register(vanishing)
    registry.register(other.draft)

    registry.commitAll()

    expect(commits).toBe(1)
    expect(other.state.commits).toBe(1)
    expect(registry.pending).toBe(false)
  })
})
