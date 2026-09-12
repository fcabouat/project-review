import type { Anchor, FreeSlide } from '@project-review/core/model/free-slide'
import { categoryId } from '@project-review/core/values/ids'

export const blocksText = (blocks: FreeSlide['blocks']): string =>
  blocks.map((block) => block.join('\n')).join('\n\n')

/** Blank lines separate blocks; the text editor has no truncating block limit. */
export function textBlocks(text: string): FreeSlide['blocks'] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== ''),
    )
    .filter((block) => block.length > 0)
  return blocks.length > 0 ? blocks : [[]]
}

/** A category id never shares a Select value with an opening/closing position. */
export const anchorValue = (anchor: Anchor): string =>
  anchor.type === 'beforeCategory' ? `category:${anchor.categoryId}` : anchor.type

export function valueAnchor(value: string): Anchor | undefined {
  if (value === 'opening' || value === 'closing') return { type: value }
  if (!value.startsWith('category:')) return undefined
  const id = categoryId(value.slice('category:'.length))
  return id === undefined ? undefined : { type: 'beforeCategory', categoryId: id }
}
