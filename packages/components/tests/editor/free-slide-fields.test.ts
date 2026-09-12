import { describe, expect, it } from 'vitest'
import { categoryId } from '@project-review/core/values/ids'
import {
  anchorValue,
  blocksText,
  textBlocks,
  valueAnchor,
} from '../../src/editor/free-slide-fields'

describe('free slide fields', () => {
  it('retains every entered/imported block, including the fourth and later ones', () => {
    const blocks = [['A', 'A2'], ['B'], ['C'], ['D'], ['E']]
    expect(textBlocks(blocksText(blocks))).toEqual(blocks)
    expect(textBlocks('A edited\n\nB\n\nC\n\nD')).toEqual([['A edited'], ['B'], ['C'], ['D']])
  })

  it('uses blank lines as separators and keeps one empty block for empty text', () => {
    expect(textBlocks(' A \n B \n\n\n C ')).toEqual([['A', 'B'], ['C']])
    expect(textBlocks(' \n\n ')).toEqual([[]])
  })

  it('distinguishes positional anchors from arbitrary category ids', () => {
    const anchors = [
      { type: 'opening' } as const,
      { type: 'closing' } as const,
      ...['opening', 'closing', 'category:opening', 'category:', 'a:b / c'].map((id) => ({
        type: 'beforeCategory' as const,
        categoryId: categoryId(id)!,
      })),
    ]
    expect(new Set(anchors.map(anchorValue)).size).toBe(anchors.length)
    for (const anchor of anchors) expect(valueAnchor(anchorValue(anchor))).toEqual(anchor)
    expect(valueAnchor('unqualified')).toBeUndefined()
    expect(valueAnchor('category:')).toBeUndefined()
  })
})
