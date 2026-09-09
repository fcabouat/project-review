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
  import { Button } from '../../commons/ui/button'
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

<section class="bg-background border-border rounded-lg border p-4">
  <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
    {te('editor.settings.categories', language)}
  </h2>

  {#if warnings.length > 0}
    <ul
      class="bg-(--warn-bg) border-(--warn)/30 m-0 mb-3.5 flex list-none flex-col gap-[5px] rounded-md border px-3 py-2.5"
    >
      {#each warnings as warning, i (i)}
        <li class="text-(--warn) text-xs font-semibold">
          {te(warning.key, language, warning.slots)}
        </li>
      {/each}
    </ul>
  {/if}

  {#each portfolio.categories as category, index (category.id)}
    <div
      class="border-border flex items-center gap-[9px] border-b py-[7px] text-[13px] first:pt-0 last:border-b-0 last:pb-0"
    >
      <span
        class="inline-block size-2.5 flex-none rounded-full"
        style="background:{catColor(category.color)}"
        aria-hidden="true"
      ></span>
      <span class="min-w-0 flex-1 truncate font-semibold">{category.name}</span>
      <span class="text-muted-foreground text-[11px] whitespace-nowrap">{usageLabel(category)}</span
      >
      <Button
        variant="ghost"
        size="icon-xs"
        class="text-muted-foreground"
        title={te('editor.projects.moveUp', language)}
        aria-label="{te('editor.projects.moveUp', language)} {category.name}"
        disabled={index === 0}
        onclick={() => move(category, -1)}><span class="inline-block -rotate-90">▸</span></Button
      >
      <Button
        variant="ghost"
        size="icon-xs"
        class="text-muted-foreground"
        title={te('editor.projects.moveDown', language)}
        aria-label="{te('editor.projects.moveDown', language)} {category.name}"
        disabled={index === portfolio.categories.length - 1}
        onclick={() => move(category, 1)}><span class="inline-block rotate-90">▸</span></Button
      >
      <Button
        variant="ghost"
        size="icon-xs"
        class="text-muted-foreground"
        title={te('editor.projects.edit', language)}
        aria-label="{te('editor.projects.edit', language)} {category.name}"
        onclick={() =>
          (editingCategoryId = editingCategoryId === category.id ? undefined : category.id)}
        >✎</Button
      >
      <Button
        variant="ghost"
        size="icon-xs"
        class="text-muted-foreground"
        title={te('editor.preview.open', language)}
        aria-label="{te('editor.preview.open', language)} {category.name}"
        disabled={!hasDivider(category)}
        onclick={() => (previewCategory = category)}><Icon name="eye-line" /></Button
      >
      <Button
        variant="ghost"
        size="icon-xs"
        class="text-muted-foreground"
        title={usage(category) > 0
          ? te('editor.settings.deleteBlocked', language, { n: usage(category) })
          : te('editor.projects.delete', language)}
        aria-label="{te('editor.projects.delete', language)} {category.name}"
        disabled={usage(category) > 0}
        onclick={() => dispatch({ type: 'DeleteCategory', id: category.id })}
        ><Icon name="close-line" /></Button
      >
    </div>

    {#if editingCategoryId === category.id}
      <div
        class="border-border bg-secondary relative mt-0.5 mb-2 rounded-lg border px-3 pt-3 pb-2.5"
      >
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
        <span class="text-muted-foreground text-[10.5px] font-bold tracking-[0.05em] uppercase"
          >{te('editor.settings.color', language)}</span
        >
        <div class="mt-[9px] grid grid-cols-4 gap-x-1.5 gap-y-2.5">
          {#each COLORS as color (color)}
            <!-- The ADT value ("lightGreen"-style code) never shows raw:
                 the swatch speaks the catalog's language. -->
            <button
              type="button"
              class="{category.color === color
                ? 'text-primary font-bold'
                : 'text-muted-foreground'} focus-visible:outline-ring flex cursor-pointer flex-col items-center gap-1 rounded px-0 py-0.5 text-center text-[9.5px] focus-visible:outline-2 focus-visible:outline-offset-1"
              aria-pressed={category.color === color}
              title={te(`editor.color.${color}`, language)}
              onclick={() => dispatch({ type: 'RecolorCategory', id: category.id, after: color })}
            >
              <span
                class="relative size-5 rounded-full {category.color === color
                  ? 'shadow-[0_0_0_2px_var(--bg),0_0_0_3.5px_var(--accent)]'
                  : 'shadow-[0_0_0_1px_rgb(0_0_0/0.06)]'}"
                style="background:{catColor(color)}"
              >
                {#if category.color === color}
                  <span
                    class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white"
                    >✓</span
                  >
                {/if}
              </span>
              {te(`editor.color.${color}`, language)}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/each}

  <Button variant="outline" size="sm" class="mt-3 w-full" onclick={addCategory}
    >{te('editor.settings.add', language)}</Button
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
