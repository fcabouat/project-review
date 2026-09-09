/**
 * The flat deck folded into slideshow groups — the drawer navigation of the
 * canonical mockup `mockups/slides-demo.html`.
 */
import type { Portfolio } from '../model/portfolio'
import type { Slide } from './slide'
import { deck } from './deck'

/**
 * One horizontal position of the slideshow: a lone slide, or a vertical stack
 * (a "drawer" the → arrow skips and the ↓ arrow opens). Declared here and not
 * in model/ on purpose: model/ is the data contract, and this type
 * only describes a derived view of the deck.
 */
export type DeckGroup =
  | { readonly kind: 'single'; readonly slide: Slide }
  | { readonly kind: 'stack'; readonly slides: readonly Slide[] }

/**
 * The flat deck folded into slideshow groups. Built ON TOP of `deck()` so the
 * invariant holds by construction: concatenating the groups in order yields
 * `deck(p)` slide for slide, same references — the print mode, the page
 * numbers and the previews all keep reading the flat deck.
 *
 * Grouping (canon `slides-demo.html`):
 * - title, free slides, decisions, archives, previous decisions → singles;
 * - the overview block — portfolio dashboard, then the health dashboard and
 *   the recap pages when the display settings emit them — → ONE stack;
 * - each category — divider then its sheets — → ONE stack.
 * A block reduced to one slide (divider without a sheet, overview without
 * dashboard nor recap) is a single: reveal would otherwise show an empty
 * drawer.
 */
export function deckTree(p: Portfolio): readonly DeckGroup[] {
  return groupDeck(deck(p))
}

/**
 * The folding itself, over an ALREADY computed flat deck — the slides in the
 * groups are the very elements of `flat`, no copy, which is what lets a caller
 * (and the invariant test) hold the flat deck and its tree at once.
 */
export function groupDeck(flat: readonly Slide[]): readonly DeckGroup[] {
  const groups: DeckGroup[] = []
  const push = (block: readonly Slide[]): void => {
    const first = block[0]
    if (first === undefined) return
    groups.push(
      block.length === 1 ? { kind: 'single', slide: first } : { kind: 'stack', slides: block },
    )
  }

  let i = 0
  while (i < flat.length) {
    const s = flat[i]!
    if (s.type === 'portfolioDashboard') {
      // Overview drawer: the dashboards and the recap pages follow each other
      // in `deck()` whatever subset the settings enable.
      const block: Slide[] = [s]
      i += 1
      while (
        i < flat.length &&
        (flat[i]!.type === 'healthDashboard' || flat[i]!.type === 'recap')
      ) {
        block.push(flat[i]!)
        i += 1
      }
      push(block)
    } else if (s.type === 'divider') {
      // Category drawer: the divider and every sheet it announces.
      const block: Slide[] = [s]
      i += 1
      while (i < flat.length && flat[i]!.type === 'sheet') {
        block.push(flat[i]!)
        i += 1
      }
      push(block)
    } else {
      groups.push({ kind: 'single', slide: s })
      i += 1
    }
  }
  return groups
}
