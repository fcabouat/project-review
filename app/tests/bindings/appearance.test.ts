/**
 * Pins the reader-scheme wiring (`src/bindings/appearance.svelte.ts`): the
 * app-side storage of the Système/Clair/Sombre choice — a UI preference that
 * must never touch the domain (no event, nothing in the portfolio) and must
 * survive a refusing storage for the session.
 */

import { describe, expect, it } from 'vitest'
import { SCHEME_KEY, createAppearance, loadScheme } from '../../src/bindings/appearance.svelte'
import { createMemoryStorage } from '../fixtures/failing-storage'

describe('loadScheme', () => {
  it('defaults to system: nothing stored, garbage stored, or no storage at all', () => {
    const storage = createMemoryStorage()
    expect(loadScheme(storage)).toBe('system')
    storage.setItem(SCHEME_KEY, 'sepia')
    expect(loadScheme(storage)).toBe('system')
    expect(loadScheme(null)).toBe('system')
  })

  it('reads back each of the three stored choices', () => {
    const storage = createMemoryStorage()
    for (const scheme of ['system', 'light', 'dark'] as const) {
      storage.setItem(SCHEME_KEY, scheme)
      expect(loadScheme(storage)).toBe(scheme)
    }
  })
})

describe('createAppearance', () => {
  it('starts on the stored choice and writes every change through', () => {
    const storage = createMemoryStorage()
    storage.setItem(SCHEME_KEY, 'dark')
    const control = createAppearance(storage)
    expect(control.scheme).toBe('dark')

    control.setScheme('light')
    expect(control.scheme).toBe('light')
    expect(storage.getItem(SCHEME_KEY)).toBe('light')
  })

  it('keeps the in-memory choice when the storage refuses the write', () => {
    const storage = createMemoryStorage()
    const control = createAppearance(storage)
    storage.refuse = () => true
    control.setScheme('dark')
    expect(control.scheme).toBe('dark')
    expect(storage.getItem(SCHEME_KEY)).toBeNull()
  })

  it('works without any storage — the choice lives for the session', () => {
    const control = createAppearance(null)
    expect(control.scheme).toBe('system')
    control.setScheme('dark')
    expect(control.scheme).toBe('dark')
  })
})
