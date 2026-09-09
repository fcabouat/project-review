/**
 * Pins the font service (`src/fonts.ts`) — safe stack building, the
 * bundled-vs-Google family split, and the idempotent link injection on a fake
 * document.
 */
import { describe, expect, it } from 'vitest'
import { applyFont, fontLinkId, fontStack, googleFontsUrl, probeFont } from '../src/fonts'

describe('font service', () => {
  it('fontStack: Roboto (default) and empty fall back, others are prepended quoted', () => {
    expect(fontStack('Roboto')).toBe("'Roboto', 'Inter', 'Segoe UI', system-ui, sans-serif")
    expect(fontStack('  ')).toBe("'Roboto', 'Inter', 'Segoe UI', system-ui, sans-serif")
    expect(fontStack('Inter')).toBe("'Inter', 'Roboto', 'Segoe UI', system-ui, sans-serif")
    expect(fontStack('Marianne')).toBe(
      "'Marianne', 'Roboto', 'Inter', 'Segoe UI', system-ui, sans-serif",
    )
    expect(fontStack('IBM Plex Sans')).toContain("'IBM Plex Sans', 'Roboto'")
    expect(fontStack('O\'Weird"Name')).toContain("'OWeirdName'") // quotes stripped, never injected
  })

  it('googleFontsUrl: null for bundled families, css2 URL otherwise', () => {
    expect(googleFontsUrl('Roboto')).toBeNull() // bundled since @fontsource/roboto
    expect(googleFontsUrl('Inter')).toBeNull()
    expect(googleFontsUrl('Marianne')).toBeNull()
    expect(googleFontsUrl('IBM Plex Sans')).toBe(
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&display=swap',
    )
  })

  it('applyFont: sets the variable, injects the link once, tolerates no document', () => {
    const links: Array<{ id: string; rel: string; href: string }> = []
    const vars = new Map<string, string>()
    const fake = {
      documentElement: { style: { setProperty: (k: string, v: string) => void vars.set(k, v) } },
      getElementById: (id: string) => links.find((l) => l.id === id) ?? null,
      createElement: () => ({ id: '', rel: '', href: '' }),
      head: { appendChild: (l: { id: string; rel: string; href: string }) => void links.push(l) },
    } as unknown as Document

    applyFont('IBM Plex Sans', fake)
    applyFont('IBM Plex Sans', fake) // deduplicated
    applyFont('Marianne', fake) // no fetch
    expect(vars.get('--font')).toContain("'Marianne'")
    expect(links).toHaveLength(1)
    expect(links[0]!.id).toBe(fontLinkId('IBM Plex Sans'))
    expect(() => applyFont('Anything', undefined)).not.toThrow()
  })

  /** A doc exposing exactly the Font Loading surface the probe touches. */
  const fontsDoc = (
    load: (probe: string) => Promise<unknown[]>,
    check: (probe: string) => boolean,
  ) => ({ fonts: { load, check } }) as unknown as Document

  it('probeFont: a face the load resolves is served', async () => {
    const doc = fontsDoc(
      async () => [{ family: 'Marianne' }],
      () => true,
    )
    await expect(probeFont('Marianne', doc)).resolves.toBe('served')
  })

  it('probeFont: an empty load answered by check() still counts as served', async () => {
    // Some engines resolve load() with [] yet render the face — check() is
    // the tie-breaker, asked only AFTER the forced load (before it, check
    // reports unloaded declared faces as unavailable).
    const doc = fontsDoc(
      async () => [],
      () => true,
    )
    await expect(probeFont('Marianne', doc)).resolves.toBe('served')
  })

  it('probeFont: nothing loads, check refuses — missing', async () => {
    const doc = fontsDoc(
      async () => [],
      () => false,
    )
    await expect(probeFont('Marianne', doc)).resolves.toBe('missing')
  })

  it('probeFont: a rejecting load degrades to missing, never a throw', async () => {
    const doc = fontsDoc(
      () => Promise.reject(new Error('network')),
      () => true,
    )
    await expect(probeFont('Marianne', doc)).resolves.toBe('missing')
  })

  it('probeFont: no document or no Font Loading API — unknown (no way to ask)', async () => {
    await expect(probeFont('Marianne', undefined)).resolves.toBe('unknown')
    await expect(probeFont('Marianne', {} as unknown as Document)).resolves.toBe('unknown')
  })

  it('probeFont: a blank family is missing by definition; quotes are stripped', async () => {
    const probes: string[] = []
    const doc = fontsDoc(
      async (probe) => {
        probes.push(probe)
        return []
      },
      () => false,
    )
    await expect(probeFont('   ', doc)).resolves.toBe('missing')
    await probeFont('"Marianne"', doc)
    expect(probes).toEqual(['16px "Marianne"'])
  })
})
