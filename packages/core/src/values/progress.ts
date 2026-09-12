/**
 * Progress. A progress is a number PROVED to be an integer percentage in
 * 0–100: `Progress` is a `number` the compiler refuses to fabricate — only
 * {@link progressOf} produces one, and it refuses anything else. There is no
 * clamping or rounding constructor: an out-of-range value is the caller's
 * problem to surface, never a value to repair silently.
 *
 * PURE module: no dependency beyond the wrapper type.
 */
import type { Brand } from './refine'

/** An integer percentage, 0–100 — what `Project.progress` stores. */
export type Progress = Brand<number, 'Progress'>

/** The one way to a valid {@link Progress}: `undefined` unless `n` already is
 * an integer in 0–100 — the caller decides what refusal means. */
export const progressOf = (n: number): Progress | undefined =>
  Number.isInteger(n) && n >= 0 && n <= 100 ? (n as Progress) : undefined
