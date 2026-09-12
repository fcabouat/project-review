/**
 * Pins the third-party notices table (`src/data/third-party.ts`) — the ONE
 * source the About screen renders and `THIRD-PARTY.md` restates.
 *
 * A notice is only worth carrying if it is complete: a missing copyright line
 * or a placeholder URL is not a smaller notice, it is a false one. These
 * checks are about the shape, not the wording — verifying that a license
 * matches the installed package is a reading job (done, and recorded in the
 * module header), not something a unit test can assert without shipping
 * node_modules.
 */
import { describe, expect, it } from 'vitest'
import { IMPORTED_CONTENT_NOTICE, THIRD_PARTY_NOTICES } from '../../src/data/third-party'

describe('third-party notices', () => {
  it('carries a complete notice for every component', () => {
    expect(THIRD_PARTY_NOTICES.length).toBeGreaterThan(0)
    for (const n of THIRD_PARTY_NOTICES) {
      expect(n.name.trim(), n.name).not.toBe('')
      expect(n.version.trim(), n.name).not.toBe('')
      expect(n.license.trim(), n.name).not.toBe('')
      // The copyright line is the one thing every license here requires.
      expect(n.copyright, n.name).toMatch(/copyright/i)
      expect(n.url, n.name).toMatch(/^https:\/\//)
      expect(n.use.trim(), n.name).not.toBe('')
      if (n.note !== undefined) expect(n.note.trim(), n.name).not.toBe('')
    }
  })

  it('names each component once', () => {
    const names = THIRD_PARTY_NOTICES.map((n) => n.name)
    expect(new Set(names).size).toBe(names.length)
  })

  /* The one entry whose declared metadata and shipped license disagree: the
     package says Apache-2.0, the file it ships is its own license. The note
     exists so a reader is not misled by either. */
  it('states the license the package FILE carries, not the metadata field', () => {
    const remix = THIRD_PARTY_NOTICES.find((n) => n.name === 'Remix Icon')
    expect(remix).toBeDefined()
    expect(remix!.license).toBe('Remix Icon License v1.0')
    expect(remix!.note).toMatch(/Apache-2\.0/)
  })

  it('the fonts carry their OFL notice — the license that travels with the files', () => {
    const fonts = THIRD_PARTY_NOTICES.filter((n) => n.license.includes('Open Font License'))
    expect(fonts.length).toBeGreaterThan(0)
    for (const f of fonts) expect(f.note, f.name).toBeDefined()
  })

  it('says what the product license does NOT cover', () => {
    expect(IMPORTED_CONTENT_NOTICE).toMatch(/MIT/)
    expect(IMPORTED_CONTENT_NOTICE).toMatch(/imported by users/)
  })
})
