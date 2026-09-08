/**
 * `review` block — title and the two review dates. `reviewDate` is what makes
 * every derivation definable without a clock (law 1): it must be a
 * calendar-valid date, like every other date in the file.
 */
import type { Review } from '../../model/portfolio'
import { isoDate } from '../../values/date'
import type { Errors } from './json'
import { at, checkKeys, dateVal, optStr, record, str } from './json'

/** Placeholder for a refused block — the caller only hands out a portfolio
 * when the error list is empty, so this value can never be observed. */
const NEVER_DATE = isoDate('1970-01-01')!

/** Parses the `review` block, collecting every violation. */
export function parseReview(x: unknown, errors: Errors): Review {
  const o = record(x, 'review', errors)
  if (o === undefined) return { title: '', reviewDate: NEVER_DATE }
  checkKeys(o, 'review', ['title', 'reviewDate'], ['subtitle', 'previousReviewDate'], errors)
  return {
    title: str(o['title'], at('review', 'title'), errors) ?? '',
    subtitle: optStr(o['subtitle'], at('review', 'subtitle'), errors),
    reviewDate: dateVal(o['reviewDate'], at('review', 'reviewDate'), errors) ?? NEVER_DATE,
    previousReviewDate: dateVal(
      o['previousReviewDate'],
      at('review', 'previousReviewDate'),
      errors,
    ),
  }
}
