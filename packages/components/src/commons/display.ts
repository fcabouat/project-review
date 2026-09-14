/**
 * Entered labels may be EMPTY — a milestone label, a free-slide title: the
 * data keeps the honest `''`, and every display goes through this fallback to
 * show "—" instead of a blank. The dash is typography, never written back.
 *
 * PURE module: no Svelte, no DOM, no clock.
 */
export function displayLabel(text: string | undefined): string {
  return text === undefined || text.trim() === '' ? '—' : text
}
