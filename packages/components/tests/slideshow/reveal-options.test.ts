/**
 * Pins the shared reveal option set (`src/slideshow/reveal-options.ts`) — one
 * object for the live host AND the standalone export (the app injects it into
 * the infrastructure's builder): the options the drawer navigation depends on.
 */

import { describe, expect, it } from 'vitest'
import { STANDALONE_REVEAL_OPTIONS } from '../../src/slideshow/reveal-options'

describe('STANDALONE_REVEAL_OPTIONS', () => {
  it('pins the options the drawer navigation depends on', () => {
    expect(STANDALONE_REVEAL_OPTIONS).toMatchObject({
      controls: true,
      controlsLayout: 'edges',
      controlsBackArrows: 'faded',
      progress: true,
      overview: true,
      navigationMode: 'default',
      transition: 'slide',
      backgroundTransition: 'fade',
      slideNumber: false,
      hash: false,
      center: false,
    })
  })

  it('is JSON-serialisable verbatim — the export writes it into the file', () => {
    expect(JSON.parse(JSON.stringify(STANDALONE_REVEAL_OPTIONS))).toEqual(STANDALONE_REVEAL_OPTIONS)
  })
})
