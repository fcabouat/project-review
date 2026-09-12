/**
 * Technical JSON decoding — the small shared vocabulary the per-aggregate
 * parsers are written in. Every reader COLLECTS instead of throwing: a
 * violation is pushed onto the shared error list and the reader returns
 * `undefined`, so one pass over the file reports every fault at once.
 *
 * Presence is checked once, structurally ({@link checkKeys}: required keys
 * present, no unknown key); the value readers then only judge the VALUE of a
 * key that is there — a missing required key is never reported twice.
 */
import { MAX_ROWS } from '../../model/budget'
import type { KeySet } from '../../model/contract'
import type { IsoDate } from '../../values/date'
import { isoDate } from '../../values/date'
import type { ParseError, ParseErrorCode } from './errors'

/** The mutable error sink one `parsePortfolio` call threads everywhere. */
export type Errors = ParseError[]

/** Pushes one structured error — the single write point of the sink. */
export function fail(
  errors: Errors,
  path: string,
  code: ParseErrorCode,
  params?: Readonly<Record<string, string>>,
): void {
  errors.push(params === undefined ? { path, code } : { path, code, params })
}

export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/** Joins a parent path and a key — the root's children keep bare names. */
export const at = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`)

/**
 * Structural check of one object against the aggregate's KEY SET: every
 * required key present, every present key known — `missingKey` / `unknownKey`
 * otherwise.
 *
 * The set comes from `model/contract.ts`, where it is stated ONCE and read by
 * both sides: this parse on the way in, `ownKeysOnly` on an object already in
 * memory. Two lists would drift, and the drift has a name — a runtime object
 * carrying a key the contract does not own, accepted as a command, stored, and
 * refused by this very function at the next boot.
 */
export function checkKeys(
  o: Record<string, unknown>,
  path: string,
  keys: KeySet,
  errors: Errors,
): void {
  for (const key of keys.required) {
    if (!(key in o)) fail(errors, at(path, key), 'missingKey')
  }
  for (const key of Object.keys(o)) {
    if (!keys.required.includes(key) && !keys.optional.includes(key)) {
      fail(errors, at(path, key), 'unknownKey')
    }
  }
}

/** An ad-hoc set for the one place that has no aggregate of its own — the
 * exhaustive table of the twelve palette colours. */
export const exactly = (required: readonly string[]): KeySet => ({ required, optional: [] })

/**
 * An object field: `undefined` (with a `wrongType`) unless `x` is a plain
 * object. Absence stays silent — `checkKeys` already spoke if it mattered.
 */
export function record(
  x: unknown,
  path: string,
  errors: Errors,
): Record<string, unknown> | undefined {
  if (x === undefined) return undefined
  if (isRecord(x)) return x
  fail(errors, path, 'wrongType', { expected: 'object' })
  return undefined
}

/**
 * A nested collection within the memory-safety budget (`MAX_ROWS`,
 * model/budget.ts) — the ceiling one aggregate may carry. Reported with the
 * SAME code as the entity ceiling, because it is the same budget said of a
 * smaller collection; `path` is what tells the two apart. Checked BEFORE the
 * elements are read, like the entity count: the walk is the cost being
 * refused.
 */
export function withinRows(x: unknown, path: string, errors: Errors): boolean {
  if (!Array.isArray(x) || x.length <= MAX_ROWS) return true
  fail(errors, path, 'tooManyEntities', { max: String(MAX_ROWS), count: String(x.length) })
  return false
}

/** An array field — same contract as {@link record}. */
export function list(x: unknown, path: string, errors: Errors): readonly unknown[] | undefined {
  if (x === undefined) return undefined
  if (Array.isArray(x)) return x
  fail(errors, path, 'wrongType', { expected: 'array' })
  return undefined
}

/** A string value; any string passes, including the empty one. */
export function str(x: unknown, path: string, errors: Errors): string | undefined {
  if (x === undefined) return undefined
  if (typeof x === 'string') return x
  fail(errors, path, 'wrongType', { expected: 'string' })
  return undefined
}

/**
 * An OPTIONAL string value: same typing contract as {@link str}, but the empty
 * string normalises to absence — the model treats absence as the meaningful
 * "not filled" state, and `""` says exactly that.
 */
export function optStr(x: unknown, path: string, errors: Errors): string | undefined {
  const s = str(x, path, errors)
  return s === '' ? undefined : s
}

/** A boolean value. */
export function bool(x: unknown, path: string, errors: Errors): boolean | undefined {
  if (x === undefined) return undefined
  if (typeof x === 'boolean') return x
  fail(errors, path, 'wrongType', { expected: 'boolean' })
  return undefined
}

/** A calendar-valid date: `wrongType` when not a string, `invalidDate` when
 * the string is not a calendar YYYY-MM-DD — built through the constructor. */
export function dateVal(x: unknown, path: string, errors: Errors): IsoDate | undefined {
  if (x === undefined) return undefined
  if (typeof x !== 'string') {
    fail(errors, path, 'wrongType', { expected: 'string' })
    return undefined
  }
  const d = isoDate(x)
  if (d === undefined) fail(errors, path, 'invalidDate', { value: x })
  return d
}

/** A member of a closed enumeration — `invalidEnum` names the allowed set. */
export function enumVal<T extends string>(
  x: unknown,
  values: readonly T[],
  path: string,
  errors: Errors,
): T | undefined {
  if (x === undefined) return undefined
  if (typeof x === 'string' && (values as readonly string[]).includes(x)) return x as T
  fail(errors, path, 'invalidEnum', { value: String(x), allowed: values.join(' | ') })
  return undefined
}

/** An array of strings — each faulty element is reported at its own index. */
export function strList(x: unknown, path: string, errors: Errors): readonly string[] | undefined {
  const items = list(x, path, errors)
  if (items === undefined) return undefined
  const out: string[] = []
  items.forEach((v, i) => {
    if (typeof v === 'string') out.push(v)
    else fail(errors, `${path}[${i}]`, 'wrongType', { expected: 'string' })
  })
  return out
}

/**
 * An id: any non-empty string, unique within its collection. Reports
 * `emptyId` / `duplicateId` and returns the RAW string either way — the
 * aggregate keeps parsing the element to surface its other faults, and the
 * whole file is refused anyway.
 */
export function idStr(x: unknown, seen: Set<string>, path: string, errors: Errors): string {
  const s = str(x, path, errors) ?? ''
  if (x !== undefined && typeof x === 'string' && s === '') fail(errors, path, 'emptyId')
  if (s !== '') {
    if (seen.has(s)) fail(errors, path, 'duplicateId', { id: s })
    seen.add(s)
  }
  return s
}
