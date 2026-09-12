/**
 * Pins the display bound of a refusal report (`src/editor/error-report.ts`):
 * the COUNT stays exhaustive, the LIST does not, and the whole report is still
 * obtainable as text. The fault behind it was measured: 160 000 errors, one
 * list item each, and an interface that tried to draw all of them.
 */
import { describe, expect, it } from 'vitest'
import type { ParseError } from '@project-review/core/services/parse'
import {
  ERROR_LIST_MAX,
  errorReportText,
  isTruncated,
  shownErrors,
} from '../../src/editor/error-report'

/** `n` violations, each at its own path — the shape a wrong-typed long array
 * produces, which is the shape that grew to six figures. */
const manyErrors = (n: number): readonly ParseError[] =>
  Array.from({ length: n }, (_, i) => ({
    path: `projects[${i}].done[0]`,
    code: 'wrongType' as const,
    params: { expected: 'string' },
  }))

/** The caller's localized wording, standing in for `te()`. */
const wording = (error: ParseError): string => `${error.code}(${error.params?.['expected'] ?? ''})`

describe('shownErrors', () => {
  it('hands back a short report whole, and the same array', () => {
    const few = manyErrors(3)
    expect(shownErrors(few)).toBe(few)
    expect(isTruncated(few)).toBe(false)
  })

  it('hands back exactly the bound at the bound', () => {
    const exact = manyErrors(ERROR_LIST_MAX)
    expect(shownErrors(exact)).toBe(exact)
    expect(isTruncated(exact)).toBe(false)
  })

  it('draws the first ones only past the bound — and the count stays true', () => {
    const flood = manyErrors(160_000)
    expect(shownErrors(flood)).toHaveLength(ERROR_LIST_MAX)
    expect(shownErrors(flood)[0]).toStrictEqual(flood[0])
    expect(isTruncated(flood)).toBe(true)
    // The caller reads the total off the report itself, never off the list.
    expect(flood).toHaveLength(160_000)
  })
})

describe('errorReportText', () => {
  it('writes every violation, path first, one per line', () => {
    const text = errorReportText(manyErrors(3), wording)
    expect(text.split('\n')).toStrictEqual([
      'projects[0].done[0] : wrongType(string)',
      'projects[1].done[0] : wrongType(string)',
      'projects[2].done[0] : wrongType(string)',
    ])
  })

  it('a root violation carries no path and says so by having none', () => {
    expect(errorReportText([{ path: '', code: 'notAnObject' }], wording)).toBe('notAnObject()')
  })

  it('is the WHOLE report, not the drawn part of it', () => {
    const flood = manyErrors(ERROR_LIST_MAX + 5)
    expect(errorReportText(flood, wording).split('\n')).toHaveLength(ERROR_LIST_MAX + 5)
  })
})
