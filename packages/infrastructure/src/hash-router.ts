/**
 * Hash router — the app's six screens as addresses, zero dependency:
 * `#/review` (default), `#/projects`, `#/sheet/{id}`, `#/settings`,
 * `#/history`, `#/about`. Hash-based so the deliverable keeps working from `file://`,
 * with the browser's own back/forward. The slideshow stays an overlay, not a
 * route (it covers the current screen and must come back to it).
 *
 * The pure half (`parseRoute`/`routeHash`) is unit-tested; the DOM half below
 * is the thin glue over `location`/`hashchange` that the app's reactive
 * router (`app/src/bindings/route.svelte.ts`) plugs into.
 */

/** One screen address. `sheet` carries the project id read from the hash. */
export type Route =
  | { readonly name: 'review' }
  | { readonly name: 'projects' }
  | { readonly name: 'settings' }
  | { readonly name: 'history' }
  | { readonly name: 'about' }
  | { readonly name: 'sheet'; readonly id: string }

/** The address every unrecognized hash falls back to — the app has no 404. */
const DEFAULT_ROUTE: Route = { name: 'review' }

/**
 * `decodeURIComponent` is the one THROWING call on this path: `%`, `%zz` and
 * any lone surrogate escape raise a `URIError`, and the hash is attacker- and
 * typo-supplied alike. A segment that cannot be decoded is not an id, so it
 * yields `undefined` and the caller falls back — a malformed address must cost
 * a redirect, never the whole router.
 */
const decodeSegment = (segment: string): string | undefined => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return undefined
  }
}

/**
 * Total parse of a `location.hash`: anything unrecognized — empty hash, typo,
 * `#/sheet/` without an id, `#/sheet/%` whose escape is malformed — lands on
 * the default screen rather than a 404 the app does not have.
 */
export const parseRoute = (hash: string): Route => {
  const path = hash.replace(/^#/, '')
  if (path === '/projects') return { name: 'projects' }
  if (path === '/settings') return { name: 'settings' }
  if (path === '/history') return { name: 'history' }
  if (path === '/about') return { name: 'about' }
  const sheet = /^\/sheet\/([^/]+)$/.exec(path)
  if (sheet === null) return DEFAULT_ROUTE
  const id = decodeSegment(sheet[1]!)
  return id === undefined ? DEFAULT_ROUTE : { name: 'sheet', id }
}

/** The `href` of a route — used verbatim by the sidebar's `<a>` links. */
export const routeHash = (route: Route): string =>
  route.name === 'sheet' ? `#/sheet/${encodeURIComponent(route.id)}` : `#/${route.name}`

/* v8 ignore start -- DOM half (location, hashchange): exercised by the
   file:// Playwright smoke test on the built deliverable, out of the node
   coverage perimeter by design — the pure half above is what unit tests own. */
/** The route the address bar currently shows. */
export const currentRoute = (): Route => parseRoute(location.hash)

/**
 * Follows `location.hash` for the page's lifetime (the app mounts exactly one
 * listener): every change — link click, back/forward, `pushRoute` below —
 * lands in `listener`, already parsed.
 */
export const onRouteChange = (listener: (route: Route) => void): void => {
  window.addEventListener('hashchange', () => listener(parseRoute(location.hash)))
}

/** Pushes a new entry (a click somewhere that is not a real link). */
export const pushRoute = (route: Route): void => {
  location.hash = routeHash(route)
}

/** Replaces the current entry — redirects (unknown sheet id, renumbering).
 * Same document, fragment only: no reload, no new history entry, and the
 * `hashchange` listener syncs the reactive route. */
export const replaceRoute = (route: Route): void => {
  location.replace(routeHash(route))
}
/* v8 ignore stop */
