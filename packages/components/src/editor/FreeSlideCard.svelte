<script lang="ts">
  /**
   * One free slide: title, anchor, blocks. Title and anchor move together
   * with the blocks inside a single `ChangeFreeSlide` — the event replaces the
   * whole slide, so splitting the form into three commands would only make the
   * history noisier without making it more precise.
   *
   * Store-agnostic: the host hands a `dispatch` down; the card only builds
   * commands (never a `before` — `decide` recovers it from the portfolio).
   *
   * Blocks ↔ text: one line = one bullet, a BLANK LINE opens the next block
   * (1 to 3 blocks). That round trip is the only place the editor turns
   * text into structure, hence the explicit helpers below.
   */
  import type { Anchor, FreeSlide } from '@project-review/core/model/free-slide'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { categoryId } from '@project-review/core/values/ids'
  import type { Dispatch } from '../contracts'
  import { te } from '../i18n'
  import FieldText from './FieldText.svelte'
  import Icon from '../commons/Icon.svelte'
  import { Button } from '../commons/ui/button'
  import * as Select from '../commons/ui/select'
  import SlidePreviewDialog from './SlidePreviewDialog.svelte'
  import { displayLabel } from '../commons/display'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    readonly slide: FreeSlide
  }

  let { portfolio, dispatch, slide }: Props = $props()

  let previewing = $state(false)

  const language = $derived(portfolio.settings.language)

  const asText = $derived(slide.blocks.map((block) => block.join('\n')).join('\n\n'))

  /** Text → blocks: split on blank lines, at most 3 blocks, drop empty lines. */
  function toBlocks(text: string): readonly (readonly string[])[] {
    const blocks = text
      .split(/\n\s*\n/)
      .map((block) =>
        block
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line !== ''),
      )
      .filter((block) => block.length > 0)
      .slice(0, 3)
    return blocks.length > 0 ? blocks : [[]]
  }

  function replace(next: FreeSlide): void {
    dispatch({ type: 'ChangeFreeSlide', id: slide.id, after: next })
  }

  function anchorLabel(anchor: Anchor): string {
    if (anchor.type === 'beforeCategory') {
      const category = portfolio.categories.find((c) => c.id === anchor.categoryId)
      return te('editor.anchor.beforeCategory', language, {
        name: category?.name ?? anchor.categoryId,
      })
    }
    return te(`editor.anchor.${anchor.type}`, language)
  }

  function onAnchorChange(value: string): void {
    if (value === 'opening' || value === 'closing') {
      replace({ ...slide, anchor: { type: value } })
      return
    }
    // The select only offers real category ids; the constructor brands them.
    const target = categoryId(value)
    if (!target) return
    const anchor: Anchor = { type: 'beforeCategory', categoryId: target }
    replace({ ...slide, anchor })
  }

  const anchorValue = $derived(
    slide.anchor.type === 'beforeCategory' ? slide.anchor.categoryId : slide.anchor.type,
  )
</script>

<div class="border-border mb-3.5 rounded-lg border px-4 py-3.5 last-of-type:mb-0">
  <div class="mb-1.5 flex items-center justify-between">
    <span class="text-muted-foreground text-[11px] font-bold tracking-[0.05em] uppercase">
      {anchorLabel(slide.anchor)}
    </span>
    <span class="flex gap-0.5">
      <Button
        variant="ghost"
        size="icon-xs"
        title={te('editor.preview.freeSlide', language)}
        aria-label={te('editor.preview.freeSlide', language)}
        onclick={() => (previewing = true)}><Icon name="eye-line" /></Button
      >
      <Button
        variant="ghost"
        size="icon-xs"
        title={te('editor.projects.delete', language)}
        aria-label={te('editor.projects.delete', language)}
        onclick={() => dispatch({ type: 'DeleteFreeSlide', id: slide.id })}
        ><Icon name="close-line" /></Button
      >
    </span>
  </div>

  {#if previewing}
    <SlidePreviewDialog
      {portfolio}
      slide={{ type: 'freeform', slideId: slide.id }}
      subject={te('editor.preview.subject.freeform', language, {
        title: displayLabel(slide.title),
      })}
      close={() => (previewing = false)}
    />
  {/if}

  <FieldText
    {language}
    label={te('editor.field.title', language)}
    value={slide.title}
    commit={(v) => replace({ ...slide, title: v ?? '' })}
  />

  <div class="mb-3.5 flex flex-col last:mb-0">
    <span class="text-(--txt2) mb-[5px] text-[12.5px] font-semibold"
      >{te('editor.settings.anchor', language)}</span
    >
    <Select.Root type="single" value={anchorValue} onValueChange={onAnchorChange}>
      <Select.Trigger class="w-full" aria-label={te('editor.settings.anchor', language)}>
        {anchorLabel(slide.anchor)}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="opening" label={te('editor.anchor.opening', language)} />
        {#each portfolio.categories as category (category.id)}
          <Select.Item
            value={category.id}
            label={te('editor.anchor.beforeCategory', language, { name: category.name })}
          />
        {/each}
        <Select.Item value="closing" label={te('editor.anchor.closing', language)} />
      </Select.Content>
    </Select.Root>
  </div>

  <FieldText
    {language}
    label={te('editor.settings.blocks', language)}
    value={asText}
    rows={4}
    hint={te('editor.hint.bullets', language)}
    commit={(v) => replace({ ...slide, blocks: toBlocks(v ?? '') })}
  />
</div>
