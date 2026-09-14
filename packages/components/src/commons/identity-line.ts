/**
 * Identity line — joins the non-empty parts of the organization block with a
 * separator, so a blank first-launch identity (org, unit… all empty until the
 * user types their own) never renders an orphan « · » or « — » nor a ghost
 * line: zero parts yield the empty string, and the caller hides the element.
 *
 * PURE module: strings in, string out (commons contract — extractible atom).
 */
export function identityLine(separator: string, ...parts: readonly (string | undefined)[]): string {
  return parts.filter((part) => part !== undefined && part.trim() !== '').join(separator)
}
