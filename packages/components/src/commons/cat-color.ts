/**
 * Category color lookup — `var(--cat-<name>)`, resolved by whichever ancestor
 * carries the `data-palette` attribute (`palettes.css`). The core knows only
 * the 12 generic names plus the 'grey' sentinel; the CSS custom property is
 * what turns a name into a hex, so switching palette never touches the data
 * or re-renders a component.
 *
 * PURE module: no Svelte, no DOM.
 */
import type { Color } from '@project-review/core/model/category'

/** CSS value of a category color (or the 'grey' sentinel) under the active
 * `data-palette` — usable in inline styles, SVG fills and custom properties. */
export const catColor = (color: Color | 'grey'): string => `var(--cat-${color})`
