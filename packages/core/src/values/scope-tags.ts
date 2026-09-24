/** Shared vocabulary: compact, portable hashtags, not free-form project prose. */
export const validScopeTags = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.length <= 32 &&
  Array.from(value).every((tag) => typeof tag === 'string' && /^#[A-Za-z0-9_-]{1,63}$/.test(tag)) &&
  new Set(value).size === value.length

/** Entry convenience only; imported JSON must already contain canonical tags. */
export function scopeTagsFromText(text: string): readonly string[] | undefined {
  const tags = [
    ...new Set(
      text
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)),
    ),
  ]
  return validScopeTags(tags) ? tags : undefined
}
