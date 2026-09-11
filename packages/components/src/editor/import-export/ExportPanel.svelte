<script lang="ts">
  /** Export tab panel: serialise the portfolio — whole by default, or a partial file from the category-grouped checkboxes — with copy and download actions. */
  import { SvelteSet } from 'svelte/reactivity'
  import {
    partialPortfolio,
    portfolioFileName,
    serializePortfolio,
  } from '@project-review/core/services/portfolio-json'
  import { orphanProjects } from '@project-review/core/projections'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { UNSORTED_CATEGORY } from '@project-review/core/model/category'
  import { te } from '../../i18n'
  import { Button } from '../../commons/ui/button'
  import { Checkbox } from '../../commons/ui/checkbox'
  import { Textarea } from '../../commons/ui/textarea'

  interface Props {
    readonly portfolio: Portfolio
    readonly close: () => void
  }

  let { portfolio, close }: Props = $props()

  /** Outcome of the last copy attempt — "Copié" only if the clipboard took it. */
  let copyState = $state<'idle' | 'done' | 'failed'>('idle')

  const language = $derived(portfolio.settings.language)
  // Name and payload come from the core (`services/portfolio-json`): the file
  // stays the exact inverse of the strict parse — the bare portfolio, which
  // the stored envelope carries inside it rather than being.
  const serialised = $derived(serializePortfolio(portfolio))

  /** Export checkboxes: UNCHECKED ids (empty set = full export, the default). */
  const excluded = new SvelteSet<string>()

  interface ExportGroup {
    readonly id: string
    readonly name: string
    readonly projects: readonly Portfolio['projects'][number][]
  }

  /** Every project, category by category, orphans last — export is data, so
   * archived projects are listed too (unlike the Projects screen). Orphan
   * membership comes from the projection, never re-derived here. */
  const groups = $derived.by((): readonly ExportGroup[] => {
    const byCategory = portfolio.categories.map((category) => ({
      id: category.id,
      name: category.name,
      projects: portfolio.projects.filter((x) => x.categoryId === category.id),
    }))
    const orphans = orphanProjects(portfolio)
    return [
      ...byCategory,
      ...(orphans.length > 0
        ? [{ id: UNSORTED_CATEGORY.id, name: te('category.unsorted', language), projects: orphans }]
        : []),
    ].filter((g) => g.projects.length > 0)
  })

  const selectedIds = $derived(
    new Set<string>(portfolio.projects.map((x) => x.id).filter((id) => !excluded.has(id))),
  )
  const allSelected = $derived(selectedIds.size === portfolio.projects.length)
  // Full selection keeps the historic export byte for byte (free slides included).
  const exportSource = $derived(
    allSelected ? serialised : serializePortfolio(partialPortfolio(portfolio, selectedIds)),
  )
  const exportName = $derived(portfolioFileName(portfolio.review.reviewDate, !allSelected))

  function setChecked(ids: readonly string[], on: boolean): void {
    for (const id of ids) {
      if (on) excluded.delete(id)
      else excluded.add(id)
    }
  }

  async function copy(): Promise<void> {
    // No clipboard (insecure context, old browser) or a refused write must not
    // pretend: the button then reports the failure instead of "Copied".
    try {
      if (navigator.clipboard === undefined) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(exportSource)
      copyState = 'done'
    } catch {
      copyState = 'failed'
    }
    setTimeout(() => (copyState = 'idle'), 1500)
  }

  function download(): void {
    const url = URL.createObjectURL(new Blob([exportSource], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = exportName
    link.click()
    URL.revokeObjectURL(url)
  }
</script>

<div class="p-5">
  {#if groups.length > 0}
    <fieldset
      class="border-border mb-3 max-h-[220px] overflow-auto rounded-md border px-3.5 pt-2.5 pb-3"
    >
      <legend class="text-(--txt2) px-1 text-xs font-bold"
        >{te('editor.io.selection', language)} — {te('editor.io.selectionCount', language, {
          n: selectedIds.size,
          total: portfolio.projects.length,
        })}</legend
      >
      {#each groups as group (group.id)}
        {@const ids = group.projects.map((x) => x.id)}
        {@const checkedCount = ids.filter((id) => !excluded.has(id)).length}
        <div class="mt-1.5">
          <label class="flex cursor-pointer items-center gap-2 text-[13px] font-bold">
            <Checkbox
              checked={checkedCount === ids.length}
              indeterminate={checkedCount > 0 && checkedCount < ids.length}
              onCheckedChange={(on) => setChecked(ids, on)}
            />
            <span>{group.name}</span>
          </label>
          {#each group.projects as x (x.id)}
            <label
              class="text-(--txt2) ml-[22px] flex cursor-pointer items-center gap-2 text-[13px]"
            >
              <Checkbox
                checked={!excluded.has(x.id)}
                onCheckedChange={(on) => setChecked([x.id], on)}
              />
              <span>{x.id} · {x.name}</span>
            </label>
          {/each}
        </div>
      {/each}
    </fieldset>
    {#if !allSelected}
      <p class="text-muted-foreground mb-3 text-[11.5px]">
        {te('editor.io.partialHint', language)}
      </p>
    {/if}
  {/if}
  <Textarea
    class="text-(--txt2) field-sizing-fixed bg-[#fafafa] font-mono text-xs leading-[1.55] dark:bg-white/5"
    rows={9}
    readonly
    aria-label={te('editor.io.export', language)}
    value={exportSource}
  ></Textarea>
  <div class="mt-4 flex justify-end gap-2.5">
    <Button variant="outline" onclick={close}>
      {te('editor.io.close', language)}
    </Button>
    <Button variant="outline" onclick={copy}>
      {te(
        copyState === 'done'
          ? 'editor.io.copied'
          : copyState === 'failed'
            ? 'editor.io.copyFailed'
            : 'editor.io.copy',
        language,
      )}
    </Button>
    <Button onclick={download}>
      {te('editor.io.download', language)}
    </Button>
  </div>
</div>
