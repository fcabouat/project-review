/**
 * Bound the on-screen error list, not the exhaustive report.
 * Import and recovery show the true total and can download every violation.
 */
import type { ParseError } from '@project-review/core/services/parse'

/**
 * How many violations the list draws. Chosen as a rendering bound, not a
 * measurement of attention: it is far more than any file a person will fix by
 * hand shows, and far less than a count that costs the browser anything. Past
 * it the header's total and the downloadable report carry the rest.
 */
export const ERROR_LIST_MAX = 200

/** The violations the list draws — the first {@link ERROR_LIST_MAX}, in the
 * order the parse collected them (which is the order of the file). */
export const shownErrors = (errors: readonly ParseError[]): readonly ParseError[] =>
  errors.length > ERROR_LIST_MAX ? errors.slice(0, ERROR_LIST_MAX) : errors

/** `true` when the list is showing less than the whole report, and the
 * interface therefore owes the reader the difference. */
export const isTruncated = (errors: readonly ParseError[]): boolean =>
  errors.length > ERROR_LIST_MAX

/**
 * The WHOLE report as plain text, one violation per line — `path` then the
 * caller's localized wording, exactly what the list shows, for the errors the
 * list could not. Built only when someone asks for the file: the cost is one
 * pass and one string, paid on a click rather than on every render.
 */
export const errorReportText = (
  errors: readonly ParseError[],
  wording: (error: ParseError) => string,
): string =>
  errors.map((e) => (e.path === '' ? wording(e) : `${e.path} : ${wording(e)}`)).join('\n')

/** Name of that file — a sibling of the portfolio's own export name. */
export const ERROR_REPORT_FILE_NAME = 'project-review-import-errors.txt'
