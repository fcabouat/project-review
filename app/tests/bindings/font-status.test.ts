/**
 * Pins the font-verdict wiring (`src/bindings/font-status.svelte.ts`): every
 * family gets an answer, because every source is LOCAL and no third party is
 * ever asked — embedded and bundled are decided outright, and ANY other
 * family is probed, whatever its name (no family is special here). A stale
 * answer never overwrites a fresher watch (epoch guard): the card tells the
 * truth of the CURRENT family only.
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
  it('answers without probing for the families the build carries', () => {
    const { probe, pending } = manualProbe()
    const wiring = createFontStatus(probe)
    expect(wiring.status).toBe('unknown')
    wiring.watch('Roboto')
    expect(wiring.status).toBe('bundled')
    wiring.watch('Inter')
    expect(wiring.status).toBe('bundled')
    expect(pending).toHaveLength(0)
  })

  /* No family is special any more: whichever one the portfolio names, the
     probe is what decides — the deployment either serves it or it does not. */
  it('probes ANY family the build does not carry, whatever its name', async () => {
    const { probe, pending } = manualProbe()
    const wiring = createFontStatus(probe)
    wiring.watch('IBM Plex Sans')
    expect(pending).toHaveLength(1)
    pending[0]!('missing')
    await Promise.resolve()
    expect(wiring.status).toBe('missing')

    wiring.watch('Totally Unknown', ['Some Other Face'])
    expect(pending).toHaveLength(2)
    pending[1]!('served')
    await Promise.resolve()
    expect(wiring.status).toBe('served')
  })

  it('probes the named family and adopts the verdict', async () => {
    const { probe, pending } = manualProbe()
    const wiring = createFontStatus(probe)
    wiring.watch('  Atelier  ')
    expect(pending).toHaveLength(1)
    expect(wiring.status).toBe('unknown') // no flash while the browser looks
    pending[0]!('served')
    await Promise.resolve()
    expect(wiring.status).toBe('served')
  })

  it('answers embedded for a covered family — no probe at all', () => {
    const { probe, pending } = manualProbe()
    const wiring = createFontStatus(probe)
    wiring.watch('Custom Face', ['Custom Face'])
    expect(wiring.status).toBe('embedded')
    // Embedded beats the served probe: the portfolio's own faces win.
    wiring.watch(' Atelier ', ['Atelier'])
    expect(wiring.status).toBe('embedded')
    expect(pending).toHaveLength(0)
    // Faces for OTHER families do not cover the current one.
    wiring.watch('Roboto', ['Atelier'])
    expect(wiring.status).toBe('bundled')
  })

  it('a stale probe answer never overwrites a fresher embedded verdict', async () => {
    const { probe, pending } = manualProbe()
    const wiring = createFontStatus(probe)
    wiring.watch('Atelier')
    expect(pending).toHaveLength(1)
    // The user embeds the family while the probe is still out.
    wiring.watch('Atelier', ['Atelier'])
    expect(wiring.status).toBe('embedded')
    pending[0]!('missing')
    await Promise.resolve()
    expect(wiring.status).toBe('embedded')
  })

  it('switching families resets to unknown and drops the stale answer', async () => {
    const { probe, pending } = manualProbe()
    const wiring = createFontStatus(probe)
    wiring.watch('Atelier')
    wiring.watch('Roboto') // user moved on before the probe answered
    pending[0]!('missing')
    await Promise.resolve()
    expect(wiring.status).toBe('bundled')

    // Back to the probed family: only the NEW probe's answer counts.
    wiring.watch('Atelier')
    expect(pending).toHaveLength(2)
    pending[1]!('served')
    await Promise.resolve()
    expect(wiring.status).toBe('served')
  })
})
