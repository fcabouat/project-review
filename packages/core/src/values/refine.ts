/**
 * Internal type-level utilities the refined values and the closed unions rest
 * on. Nothing here exists at runtime.
 *
 * PURE module: no import at all.
 */

declare const brand: unique symbol

/** Nominal wrapper: a `T` the compiler refuses to conjure from a bare literal —
 * only the constructor next to each refined type can produce one. */
export type Brand<T, Name extends string> = T & { readonly [brand]: Name }

/** `true` if `List` and `Keys` denote exactly the same set of keys — the pin
 * that keeps a runtime array and its type union from drifting apart. */
export type CoversExactly<List extends PropertyKey, Keys extends PropertyKey> = [
  Exclude<List, Keys> | Exclude<Keys, List>,
] extends [never]
  ? true
  : never
