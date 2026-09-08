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
  import type { Command } from '@project-review/core/commands'
  import { te } from '../i18n'
  import FieldText from './FieldText.svelte'
  import Icon from '../commons/Icon.svelte'
  import SlidePreviewDialog from './SlidePreviewDialog.svelte'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: (command: Command) => unknown
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

<div class="decision-card">
  <div class="decision-card-head">
    <span class="decision-index">{anchorLabel(slide.anchor)}</span>
    <span style="display:flex;gap:2px">
      <button
        class="icon-btn"
        type="button"
        title={te('editor.preview.freeSlide', language)}
        aria-label={te('editor.preview.freeSlide', language)}
        onclick={() => (previewing = true)}><Icon name="eye-line" /></button
      >
      <button
        class="icon-btn"
        type="button"
        title={te('editor.projects.delete', language)}
        aria-label={te('editor.projects.delete', language)}
        onclick={() => dispatch({ type: 'DeleteFreeSlide', id: slide.id })}>✕</button
      >
    </span>
  </div>

  {#if previewing}
    <SlidePreviewDialog
      {portfolio}
      slide={{ type: 'freeform', slideId: slide.id }}
      subject={te('editor.preview.subject.freeform', language, { title: slide.title })}
      close={() => (previewing = false)}
    />
  {/if}

  <FieldText
    {language}
    label={te('editor.field.title', language)}
    value={slide.title}
    max={60}
    commit={(v) => replace({ ...slide, title: v ?? '—' })}
  />

  <div class="field">
    <span>{te('editor.settings.anchor', language)}</span>
    <select
      class="select-trigger"
      value={anchorValue}
      aria-label={te('editor.settings.anchor', language)}
      onchange={(e) => onAnchorChange(e.currentTarget.value)}
    >
      <option value="opening">{te('editor.anchor.opening', language)}</option>
      {#each portfolio.categories as category (category.id)}
        <option value={category.id}>
          {te('editor.anchor.beforeCategory', language, { name: category.name })}
        </option>
      {/each}
      <option value="closing">{te('editor.anchor.closing', language)}</option>
    </select>
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
