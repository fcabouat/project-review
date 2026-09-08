/**
 * Svelte action: focus the node as soon as it mounts. Used by the modal
 * dialogs (`aria-modal`) so keyboard focus starts INSIDE the dialog when it
 * opens — Escape and tabbing then behave as the role promises.
 */
/* v8 ignore next 3 -- one-line DOM action, outside the node coverage perimeter */
export function autofocus(node: HTMLElement): void {
  node.focus()
}
