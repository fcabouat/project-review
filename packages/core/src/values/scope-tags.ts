/** Shared vocabulary: compact, portable hashtags, not free-form project prose. */
export const validScopeTags = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.length <= 32 &&
  Array.from(value).every((tag) => typeof tag === 'string' && /^#[a-z0-9-]{1,63}$/.test(tag)) &&
  new Set(value).size === value.length

/** Stable lexical order for the ASCII tag alphabet, without mutating the source. */
export const orderedScopeTags = (tags: readonly string[] = []): readonly string[] =>
  [...tags].sort()

/** Entry convenience only; imported JSON must already contain canonical tags. */
export function scopeTagsFromText(text: string): readonly string[] | undefined {
  const tags = [
    ...new Set(
      text
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((tag) => tag.toLowerCase().replace(/_/g, '-'))
        .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)),
    ),
  ]
  return validScopeTags(tags) ? orderedScopeTags(tags) : undefined
}
