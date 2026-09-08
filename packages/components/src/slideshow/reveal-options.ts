/**
 * THE option set of the deck — the live host (`SlideshowHost`) boots on a
 * spread of this very object (plus its explicit local overrides), and the
 * standalone export (`app`'s slideshow-export) stamps the same object into the
 * saved .html, so the two can never drift apart. `as const` keeps the object
 * JSON-serialisable by construction (no callbacks — there are none to begin
 * with).
 *
 * Drawer navigation (canon `slides-demo.html`): edge arrows show where the
 * drawers are, the progress bar situates the review, the slides keep their own
 * page counter so reveal's number stays off. No URL contract (`hash`/`history`
 * off): the deck is not addressable — and it must never fight the app's OWN
 * hash router. Standard reveal keyboard: Escape/O toggle the overview, ? the
 * help.
 */
export const STANDALONE_REVEAL_OPTIONS = {
  width: 1280,
  height: 720,
  margin: 0,
  minScale: 0.1,
  maxScale: 4,
  controls: true,
  controlsLayout: 'edges',
  controlsBackArrows: 'faded',
  progress: true,
  slideNumber: false,
  hash: false,
  respondToHashChanges: false,
  history: false,
  overview: true,
  help: true,
  pause: false,
  fragments: false,
  center: false,
  embedded: false,
  touch: true,
  navigationMode: 'default',
  transition: 'slide',
  backgroundTransition: 'fade',
} as const
