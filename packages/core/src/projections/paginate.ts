/**
 * Shared page-cutting primitive for the recap and decisions slides. No page is
 * ever empty: an empty input yields NO page at all, so the deck simply emits
 * no slide.
 */
export function paginate<T>(items: readonly T[], perPage: number): readonly (readonly T[])[] {
  if (items.length === 0) return []
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage))
  return pages
}
