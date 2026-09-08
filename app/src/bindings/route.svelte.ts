/**
 * I bind the current route to runes — one reactive cell fed by the
 * infrastructure's hash router (`@project-review/infrastructure/hash-router`),
 * which owns the parse/format vocabulary and the DOM glue.
 */

import {
  currentRoute,
  onRouteChange,
  pushRoute,
  replaceRoute,
  type Route,
} from '@project-review/infrastructure/hash-router'

export interface Router {
  /** Current route — reactive, follows back/forward. */
  readonly route: Route
  /** Pushes a new entry (a click somewhere that is not a real link). */
  readonly navigate: (route: Route) => void
  /** Replaces the current entry — redirects (unknown sheet id, renumbering). */
  readonly replace: (route: Route) => void
}

/* v8 ignore start -- thin glue over the DOM half (location, hashchange):
   exercised by the file:// Playwright smoke test on the built deliverable,
   out of the node coverage perimeter by design. */
/**
 * Binds the reactive route to `location.hash` for the page's lifetime (the
 * app mounts exactly one). Works from `file://`: only the fragment moves.
 */
export const createRouter = (): Router => {
  let route = $state.raw(currentRoute())
  onRouteChange((next) => {
    route = next
  })
  return {
    get route() {
      return route
    },
    navigate: pushRoute,
    replace: replaceRoute,
  }
}
/* v8 ignore stop */
