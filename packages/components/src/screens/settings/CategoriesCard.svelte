<script lang="ts">
  /** Categories card: create, rename, recolor, reorder, preview and delete categories. */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Category } from '@project-review/core/model/category'
  import { COLORS } from '@project-review/core/model/category'
  import { catColor } from '../../commons/cat-color'
  import { deck, projectsOfCategory } from '@project-review/core/projections'
  import { nextCategoryId } from '@project-review/core/values/ids'
  import { te } from '../../i18n'
  import FieldText from '../../editor/FieldText.svelte'
  import Icon from '../../commons/Icon.svelte'
  import SlidePreviewDialog from '../../editor/SlidePreviewDialog.svelte'
  import { portfolioWarnings } from '../../editor/validation'
  import type { Dispatch } from '../contracts'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
  }

  let { portfolio, dispatch }: Props = $props()

  let editingCategoryId = $state<string | undefined>(undefined)
  /** Mounted only while open: a closed preview renders no slide at all. */
  let previewCategory = $state<Category | undefined>(undefined)

  const language = $derived(portfolio.settings.language)
  const warnings = $derived(portfolioWarnings(portfolio))

  function usage(category: Category): number {
    return projectsOfCategory(portfolio, category.id).length
  }

  /** "3 projets" / "1 projet" — the count never shows as a bare number. */
  function usageLabel(category: Category): string {
    const n = usage(category)
    return n === 1
      ? te('editor.settings.categoryUsageOne', language)
      : te('editor.settings.categoryUsage', language, { n })
  }

  /** The dividers the deck ACTUALLY emits, number by category id — read off
   * `deck()` itself rather than re-derived here, so the divider preview can
   * never disagree with the slideshow (one derivation, law 3). */
  const dividerNumbers = $derived(
    new Map(
      deck(portfolio).flatMap((s) =>
        s.type === 'divider' ? [[s.categoryId, s.number] as const] : [],
      ),
    ),
  )

  function hasDivider(category: Category): boolean {
    return dividerNumbers.has(category.id)
  }

  function dividerNumber(category: Category): number {
    return dividerNumbers.get(category.id) ?? 0
  }

  function addCategory(): void {
    const used = new Set(portfolio.categories.map((c) => c.color))
    const color = COLORS.find((c) => !used.has(c)) ?? 'taupe'
    const category: Category = {
      id: nextCategoryId(portfolio.categories),
      name: te('editor.settings.newCategory', language),
      color,
    }
    dispatch({ type: 'CreateCategory', category, index: portfolio.categories.length })
    editingCategoryId = category.id
  }

  function move(category: Category, delta: number): void {
    const from = portfolio.categories.indexOf(category)
    const to = from + delta
    // UI clamp — the arrows are disabled at the ends; `decide` drops from === to.
    if (to < 0 || to >= portfolio.categories.length) return
    dispatch({ type: 'MoveCategory', id: category.id, to })
  }
</script>

<section class="card">
  <h2>{te('editor.settings.categories', language)}</h2>

  {#if warnings.length > 0}
    <ul class="softcheck">
      {#each warnings as warning, i (i)}
        <li>{te(warning.key, language, warning.slots)}</li>
      {/each}
    </ul>
  {/if}

  {#each portfolio.categories as category, index (category.id)}
    <div class="catrow">
      <span class="cat-dot" style="--c:{catColor(category.color)}" aria-hidden="true"></span>
      <span class="cname truncate">{category.name}</span>
      <span class="ccount">{usageLabel(category)}</span>
      <button
        class="icon-btn"
        type="button"
        title={te('editor.projects.moveUp', language)}
        aria-label="{te('editor.projects.moveUp', language)} {category.name}"
        disabled={index === 0}
        onclick={() => move(category, -1)}><span class="glyph-rot-up">▸</span></button
      >
      <button
        class="icon-btn"
        type="button"
        title={te('editor.projects.moveDown', language)}
        aria-label="{te('editor.projects.moveDown', language)} {category.name}"
        disabled={index === portfolio.categories.length - 1}
        onclick={() => move(category, 1)}><span class="glyph-rot-down">▸</span></button
      >
      <button
        class="icon-btn"
        type="button"
        title={te('editor.projects.edit', language)}
        aria-label="{te('editor.projects.edit', language)} {category.name}"
        onclick={() =>
          (editingCategoryId = editingCategoryId === category.id ? undefined : category.id)}
        >✎</button
      >
      <button
        class="icon-btn"
        type="button"
        title={te('editor.preview.open', language)}
        aria-label="{te('editor.preview.open', language)} {category.name}"
        disabled={!hasDivider(category)}
        onclick={() => (previewCategory = category)}><Icon name="eye-line" /></button
      >
      <button
        class="icon-btn"
        type="button"
        title={usage(category) > 0
          ? te('editor.settings.deleteBlocked', language, { n: usage(category) })
          : te('editor.projects.delete', language)}
        aria-label="{te('editor.projects.delete', language)} {category.name}"
        disabled={usage(category) > 0}
        onclick={() => dispatch({ type: 'DeleteCategory', id: category.id })}>✕</button
      >
    </div>

    {#if editingCategoryId === category.id}
      <div class="cat-popover">
        <FieldText
          {language}
          label={te('editor.field.name', language)}
          value={category.name}
          commit={(v) =>
            dispatch({
              type: 'RenameCategory',
              id: category.id,
              after: v ?? category.name,
            })}
        />
        <span class="pop-label">{te('editor.settings.color', language)}</span>
        <div class="swatchgrid">
          {#each COLORS as color (color)}
            <!-- The ADT value ("lightGreen"-style code) never shows raw:
                 the swatch speaks the catalog's language. -->
            <button
              type="button"
              class="swatch"
              class:selected={category.color === color}
              aria-pressed={category.color === color}
              title={te(`editor.color.${color}`, language)}
              onclick={() => dispatch({ type: 'RecolorCategory', id: category.id, after: color })}
            >
              <span class="swatch-dot" style="--c:{catColor(color)}"></span>
              {te(`editor.color.${color}`, language)}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/each}

  <button
    class="btn btn-secondary btn-sm"
    type="button"
    style="width:100%;justify-content:center;margin-top:12px"
    onclick={addCategory}>{te('editor.settings.add', language)}</button
  >
</section>

{#if previewCategory}
  <SlidePreviewDialog
    {portfolio}
    slide={{
      type: 'divider',
      categoryId: previewCategory.id,
      number: dividerNumber(previewCategory),
    }}
    subject={te('editor.preview.subject.divider', language, { name: previewCategory.name })}
    close={() => (previewCategory = undefined)}
  />
{/if}
