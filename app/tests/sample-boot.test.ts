/**
 * Pins the `?sample` boot policy (`src/sample-boot.ts`): when the demo link
 * may fill the app, and what it fills it with. The DOM reads (URL, stored
 * snapshot) live in `App.svelte`; this file exercises the whole decision.
 */
import { describe, expect, it } from 'vitest'
import { bundledSample, shouldBootSample } from '../src/sample-boot'

describe('shouldBootSample — the demo never overwrites an existing base', () => {
  it('boots the sample when the URL asks and nothing is stored', () => {
    expect(shouldBootSample('?sample', null)).toBe(true)
  })

  it('tolerates a value on the parameter and other parameters around it', () => {
    expect(shouldBootSample('?sample=1', null)).toBe(true)
    expect(shouldBootSample('?foo=bar&sample', null)).toBe(true)
  })

  it('refuses when a snapshot is stored, whatever it contains', () => {
    // If this breaks, following a `?sample` link would let the persistence
    // effect save the demo set over a real portfolio — the one loss the
    // feature must never cause.
    expect(shouldBootSample('?sample', '{"version":3}')).toBe(false)
    expect(shouldBootSample('?sample', 'not even JSON')).toBe(false)
  })

  it('refuses when the URL does not ask', () => {
    expect(shouldBootSample('', null)).toBe(false)
    expect(shouldBootSample('?print', null)).toBe(false)
  })
})

describe('bundledSample — the shipped sets, through the strict parse', () => {
  it('yields the French set, 20 projects in its own language', () => {
    const portfolio = bundledSample('fr')
    expect(portfolio?.projects).toHaveLength(20)
    expect(portfolio?.settings.language).toBe('fr')
  })

  it('yields the English set, 20 projects in its own language', () => {
    const portfolio = bundledSample('en')
    expect(portfolio?.projects).toHaveLength(20)
    expect(portfolio?.settings.language).toBe('en')
  })
})
