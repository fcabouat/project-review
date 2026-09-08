/**
 * Pins the hash router (`src/hash-router.ts`) — the PURE half only
 * (`parseRoute`/`routeHash`): the DOM half (`location`, `hashchange`) is
 * exercised by the file:// smoke test on the built deliverable, not here
 * (node environment, no DOM).
 */

import { describe, expect, it } from 'vitest'
import { parseRoute, routeHash, type Route } from '../src/hash-router'

describe('parseRoute — total over any hash', () => {
  it('maps the four fixed screens', () => {
    expect(parseRoute('#/review')).toEqual({ name: 'review' })
    expect(parseRoute('#/projects')).toEqual({ name: 'projects' })
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' })
    expect(parseRoute('#/history')).toEqual({ name: 'history' })
  })

  it('extracts the sheet id, decoded', () => {
    expect(parseRoute('#/sheet/P-01')).toEqual({ name: 'sheet', id: 'P-01' })
    expect(parseRoute('#/sheet/P%2F9')).toEqual({ name: 'sheet', id: 'P/9' })
  })

  it('defaults to review on anything unrecognized', () => {
    // Totality over hand-typed URLs: a mangled hash must land on a real
    // screen, never a blank page — file:// has no server to redirect.
    expect(parseRoute('')).toEqual({ name: 'review' })
    expect(parseRoute('#')).toEqual({ name: 'review' })
    expect(parseRoute('#/')).toEqual({ name: 'review' })
    expect(parseRoute('#/nonsense')).toEqual({ name: 'review' })
    expect(parseRoute('#/sheet/')).toEqual({ name: 'review' })
    expect(parseRoute('#/sheet/a/b')).toEqual({ name: 'review' })
    expect(parseRoute('#/REVIEW')).toEqual({ name: 'review' })
  })

  it('round-trips every route through routeHash', () => {
    const routes: readonly Route[] = [
      { name: 'review' },
      { name: 'projects' },
      { name: 'settings' },
      { name: 'history' },
      { name: 'sheet', id: 'P-01' },
      { name: 'sheet', id: 'strange id/with#chars' },
    ]
    for (const route of routes) expect(parseRoute(routeHash(route))).toEqual(route)
  })
})

describe('routeHash — the sidebar hrefs', () => {
  it('formats the fixed screens verbatim', () => {
    expect(routeHash({ name: 'review' })).toBe('#/review')
    expect(routeHash({ name: 'projects' })).toBe('#/projects')
    expect(routeHash({ name: 'settings' })).toBe('#/settings')
    expect(routeHash({ name: 'history' })).toBe('#/history')
  })

  it('encodes the sheet id', () => {
    expect(routeHash({ name: 'sheet', id: 'P-01' })).toBe('#/sheet/P-01')
    expect(routeHash({ name: 'sheet', id: 'P/9' })).toBe('#/sheet/P%2F9')
  })
})
