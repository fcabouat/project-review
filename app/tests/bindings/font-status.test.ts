/**
 * Pins the font-verdict wiring (`src/bindings/font-status.svelte.ts`): the
 * probe runs for the ONE locally served family, every switch resets to
 * `unknown`, and a stale answer never overwrites a fresher watch (epoch
 * guard) — the card must tell the truth of the CURRENT family only.
 */

import { describe, expect, it } from 'vitest'
import type { FontStatus } from '@project-review/components/screens/contracts'
import { createFontStatus } from '../../src/bindings/font-status.svelte'

/** A probe whose answers are handed out manually, in call order. */
const manualProbe = () => {
  const pending: Array<(verdict: FontStatus) => void> = []
  const probe = (): Promise<FontStatus> =>
    new Promise((resolve) => {
      pending.push(resolve)
    })
  return { probe, pending }
}

describe('createFontStatus', () => {
  it('starts unknown and stays unknown for families that are not probed', () => {
    const { probe, pending } = manualProbe()
    const wiring = createFontStatus(probe)
    expect(wiring.status).toBe('unknown')
    wiring.watch('Roboto')
    wiring.watch('IBM Plex Sans')
    expect(pending).toHaveLength(0)
    expect(wiring.status).toBe('unknown')
  })

  it('probes Marianne and adopts the verdict', async () => {
    const { probe, pending } = manualProbe()
    const wiring = createFontStatus(probe)
    wiring.watch('  Marianne  ')
    expect(pending).toHaveLength(1)
    expect(wiring.status).toBe('unknown') // no flash while the browser looks
    pending[0]!('served')
    await Promise.resolve()
    expect(wiring.status).toBe('served')
  })

  it('switching families resets to unknown and drops the stale answer', async () => {
    const { probe, pending } = manualProbe()
    const wiring = createFontStatus(probe)
    wiring.watch('Marianne')
    wiring.watch('Roboto') // user moved on before the probe answered
    pending[0]!('missing')
    await Promise.resolve()
    expect(wiring.status).toBe('unknown')

    // Back to Marianne: only the NEW probe's answer counts.
    wiring.watch('Marianne')
    expect(pending).toHaveLength(2)
    pending[1]!('served')
    await Promise.resolve()
    expect(wiring.status).toBe('served')
  })
})
