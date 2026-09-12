/**
 * Dates. A date is a string PROVED calendar-valid: `IsoDate` is a `string` the
 * compiler refuses to fabricate — only {@link isoDate} produces one, after
 * checking shape (YYYY-MM-DD) and calendar (month 01–12, day within the month,
 * February 29 only on leap years). Everything downstream consumes the value
 * without re-validating.
 *
 * Because the format is fixed-width and big-endian, plain `<`/`>` on these
 * strings IS chronological comparison — the invariant every derivation and the
 * whole clockless design lean on.
 *
 * PURE module: no clock, no dependency beyond the wrapper type.
 */
import type { Brand } from './refine'

/** A calendar-valid YYYY-MM-DD date — see the module header. */
export type IsoDate = Brand<string, 'IsoDate'>

const DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    return leap ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/**
 * The one way to a valid {@link IsoDate}: shape AND calendar are checked.
 * `undefined` for anything else — the caller decides what absence means.
 */
export const isoDate = (s: string): IsoDate | undefined => {
  const m = DATE_SHAPE.exec(s)
  if (!m) return undefined
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12) return undefined
  if (day < 1 || day > daysInMonth(Number(m[1]), month)) return undefined
  return s as IsoDate
}
