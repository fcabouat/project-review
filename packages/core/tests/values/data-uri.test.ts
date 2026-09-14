/**
 * Pins the declared-size bound (`src/values/data-uri.ts`) and the two asset
 * ceilings derived from it — the bound a file picker applies BEFORE reading,
 * where the ceilings themselves are stated in characters.
 *
 * The two must meet exactly. Too generous and the pre-check lets a file be
 * read in full to be refused on its string, which is the read it exists to
 * avoid; too strict and it refuses a logo the file format would have taken —
 * and no message would ever explain that one.
 */
import { describe, expect, it } from 'vitest'
import { maxDeclaredBytes } from '../../src/values/data-uri'
import { FONT_FACE_MAX_BYTES, FONT_FACE_MAX_CHARS } from '../../src/values/font'
import { LOGO_MAX_BYTES, LOGO_MAX_CHARS } from '../../src/values/logo'

/** Characters base64 spends on `bytes` bytes, padding included — stated here
 * independently of the source, which is the point of a pin. */
const encoded = (bytes: number): number => Math.ceil(bytes / 3) * 4

describe('the declared-size bound is the exact frontier of the character cap', () => {
  it('the bound itself fits, and one byte more cannot', () => {
    for (const cap of [0, 4, 100, 400_000, 550_000, 2_000_000]) {
      const bound = maxDeclaredBytes(cap)
      expect(encoded(bound), `${cap} fits`).toBeLessThanOrEqual(cap)
      expect(encoded(bound + 1), `${cap} + 1 byte`).toBeGreaterThan(cap)
    }
  })

  it('the two asset ceilings derive from their own cap, and from nothing else', () => {
    expect(FONT_FACE_MAX_BYTES).toBe(maxDeclaredBytes(FONT_FACE_MAX_CHARS))
    expect(LOGO_MAX_BYTES).toBe(maxDeclaredBytes(LOGO_MAX_CHARS))
    // A file at the bound could still fit — with the `data:` prefix it may not,
    // and the final check on the string is what settles that. The bound only
    // ever says what CANNOT fit.
    expect(encoded(FONT_FACE_MAX_BYTES)).toBeLessThanOrEqual(FONT_FACE_MAX_CHARS)
    expect(encoded(LOGO_MAX_BYTES)).toBeLessThanOrEqual(LOGO_MAX_CHARS)
  })
})
