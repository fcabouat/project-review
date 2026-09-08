/**
 * Pins the font service (`src/fonts.ts`) — safe stack building, the
 * bundled-vs-Google family split, and the idempotent link injection on a fake
 * document.
 */
import { describe, expect, it } from 'vitest'
import { applyFont, fontLinkId, fontStack, googleFontsUrl } from '../src/fonts'

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
})
