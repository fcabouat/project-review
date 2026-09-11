/**
 * `freeSlides` collection — id, anchor, title and at least one block, all
 * required. An anchor must be structurally valid here; a `beforeCategory`
 * pointing at a category that no longer EXISTS is fine (the deck degrades it),
 * but a malformed or empty reference is a fault.
 */
import type { Anchor, FreeSlide } from '../../model/free-slide'
import type { CategoryId, FreeSlideId } from '../../values/ids'
import type { Errors } from './json'
import { checkKeys, enumVal, fail, idStr, list, record, str, withinRows } from './json'

const ANCHOR_TYPES = ['opening', 'beforeCategory', 'closing'] as const

function parseAnchor(x: unknown, path: string, errors: Errors): Anchor {
  const o = record(x, path, errors)
  if (o === undefined) return { type: 'closing' }
  const type = enumVal(o['type'], ANCHOR_TYPES, `${path}.type`, errors)
  if (type === 'beforeCategory') {
    checkKeys(o, path, ['type', 'categoryId'], [], errors)
    const reference = str(o['categoryId'], `${path}.categoryId`, errors)
    if (reference === '') fail(errors, `${path}.categoryId`, 'emptyId')
    if (reference === undefined || reference === '') return { type: 'closing' }
    return { type, categoryId: reference as CategoryId }
  }
  checkKeys(o, path, ['type'], [], errors)
  return type === undefined ? { type: 'closing' } : { type }
}

function parseBlocks(x: unknown, path: string, errors: Errors): readonly (readonly string[])[] {
  if (!withinRows(x, path, errors)) return [[]]
  const items = list(x, path, errors)
  if (items === undefined) return [[]]
  if (items.length === 0) {
    fail(errors, path, 'emptyBlocks')
    return [[]]
  }
  const blocks: (readonly string[])[] = []
  items.forEach((raw, i) => {
    const p = `${path}[${i}]`
    if (!withinRows(raw, p, errors)) return
    const lines = list(raw, p, errors)
    if (lines === undefined) return
    const block: string[] = []
    lines.forEach((line, j) => {
      if (typeof line === 'string') block.push(line)
      else fail(errors, `${p}[${j}]`, 'wrongType', { expected: 'string' })
    })
    blocks.push(block)
  })
  return blocks.length === 0 ? [[]] : blocks
}

/** Parses the `freeSlides` collection, collecting every violation. */
export function parseFreeSlides(x: unknown, errors: Errors): readonly FreeSlide[] {
  const items = list(x, 'freeSlides', errors) ?? []
  const seen = new Set<string>()
  const freeSlides: FreeSlide[] = []
  items.forEach((raw, i) => {
    const path = `freeSlides[${i}]`
    const o = record(raw, path, errors)
    if (o === undefined) return
    checkKeys(o, path, ['id', 'anchor', 'title', 'blocks'], [], errors)
    freeSlides.push({
      id: idStr(o['id'], seen, `${path}.id`, errors) as FreeSlideId,
      anchor: parseAnchor(o['anchor'], `${path}.anchor`, errors),
      title: str(o['title'], `${path}.title`, errors) ?? '',
      blocks: parseBlocks(o['blocks'], `${path}.blocks`, errors),
    })
  })
  return freeSlides
}
