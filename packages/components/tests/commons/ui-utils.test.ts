/**
 * Pins `src/commons/ui/utils.ts` — the class combiner of the vendored
 * primitives (clsx + tailwind-merge). The editor leans on ONE property:
 * a caller's `class` prop must beat the primitive's own conflicting utility,
 * while non-conflicting utilities accumulate.
 */
import { describe, expect, it } from 'vitest'
import { cn } from '../../src/commons/ui/utils'

describe('cn — the vendored primitives resolve their class conflicts', () => {
  it('keeps the LAST of two conflicting utilities (caller wins over skeleton)', () => {
    // If this breaks, every `class` override the screens pass to a primitive
    // (dialog widths, tab styling) silently loses to the vendored default.
    expect(cn('h-9 px-3', 'h-8')).toBe('px-3 h-8')
  })

  it('accumulates non-conflicting utilities', () => {
    expect(cn('flex items-center', 'gap-2')).toBe('flex items-center gap-2')
  })

  it('flattens conditional shapes the way clsx documents them', () => {
    expect(cn('a', undefined, false, ['b', { c: true, d: false }])).toBe('a b c')
  })
})
