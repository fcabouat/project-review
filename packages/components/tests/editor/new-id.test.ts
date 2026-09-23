import { afterEach, expect, it, vi } from 'vitest'
import { newId } from '../../src/editor/new-id'

afterEach(() => vi.unstubAllGlobals())
it('mints independent UUIDs without business semantics', () => {
  const ids = Array.from({ length: 20 }, newId)
  expect(new Set(ids).size).toBe(ids.length)
  for (const id of ids)
    expect(id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
})
it('uses cryptographic bytes when randomUUID is unavailable on HTTP', () => {
  vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(0) })
  expect(newId()).toBe('00000000-0000-4000-8000-000000000000')
})
