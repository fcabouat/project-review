/**
 * Recap rows — how many projects one recap page carries. A number PROVED to be
 * an integer within the printable band: fewer than {@link RECAP_ROWS_MIN} wastes
 * a page, more than {@link RECAP_ROWS_MAX} stops fitting an A4 landscape slide.
 *
 * Stated here, at the bottom layer, so the strict parse
 * (services/parse/settings.ts), the commands the editor emits
 * (commands/contract.ts) and the settings form all read the SAME band — the
 * running model may never hold a count the file format would refuse to read
 * back.
 *
 * PURE module: no import at all.
 */

/** Fewest projects a recap page may carry. */
export const RECAP_ROWS_MIN = 6

/** Most projects a recap page may carry — beyond this, an A4 landscape slide
 * stops holding the table. */
export const RECAP_ROWS_MAX = 16

/** `true` for an integer inside the printable band — the caller decides what
 * refusal means (the parse reports it, `decide` drops the command). */
export const isRecapRows = (n: number): boolean =>
  Number.isInteger(n) && n >= RECAP_ROWS_MIN && n <= RECAP_ROWS_MAX
