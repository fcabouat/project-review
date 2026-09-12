/**
 * `categories` collection — id (non-empty, unique), name, and one of the 12
 * generic colors, all three required.
 */
import type { Category } from '../../model/category'
import { COLORS } from '../../model/category'
import { CATEGORY_KEYS } from '../../model/contract'
import type { CategoryId } from '../../values/ids'
import type { Errors } from './json'
import { checkKeys, enumVal, idStr, list, record, str } from './json'

/** Parses the `categories` collection, collecting every violation. */
export function parseCategories(x: unknown, errors: Errors): readonly Category[] {
  const items = list(x, 'categories', errors) ?? []
  const seen = new Set<string>()
  const categories: Category[] = []
  items.forEach((raw, i) => {
    const path = `categories[${i}]`
    const o = record(raw, path, errors)
    if (o === undefined) return
    checkKeys(o, path, CATEGORY_KEYS, errors)
    categories.push({
      id: idStr(o['id'], seen, `${path}.id`, errors) as CategoryId,
      name: str(o['name'], `${path}.name`, errors) ?? '',
      color: enumVal(o['color'], COLORS, `${path}.color`, errors) ?? 'blue',
    })
  })
  return categories
}
