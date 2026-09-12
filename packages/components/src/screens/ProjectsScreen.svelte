<script lang="ts">
  /**
   * Projects screen — the portfolio table, grouped by category, with the
   * instant fuzzy search. Destructive confirmation runs in the vendored
   * AlertDialog: a local pending state, then ONE dispatch on confirm.
   *
   * Two grouping rules, both meaningful:
   *  - a category with no TRACKED project shows no group (an empty category is
   *    not news);
   *  - archived projects are gathered in one collapsed `<details>` group at the
   *    bottom, out of the way but never hidden.
   *
   * The search filters, it never reorders: the portfolio order is derived meaning
   *, and a query must not silently reshuffle it.
   *
   * Pure screen: `portfolio`, `dispatch` and the `open` callback in — no store,
   * no router, no infrastructure (screens contract, `contracts.ts`).
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Category, UnsortedCategory } from '@project-review/core/model/category'
  import type { Project } from '@project-review/core/model/project'
  import { UNSORTED_CATEGORY } from '@project-review/core/model/category'
  import { SHEET_MODES } from '@project-review/core/model/project'
  import {
    groupKey,
    isArchived,
    isTracked,
    orphanProjects,
    pendingDecisionsOf,
    projectGauge,
    projectsOfCategory,
    type GroupRef,
  } from '@project-review/core/projections'
  import StageChip from '../commons/StageChip.svelte'
  import HealthDot from '../commons/HealthDot.svelte'
  import { catColor } from '../commons/cat-color'
  import { t } from '@project-review/core/services/i18n'
  import { nextProjectId } from '@project-review/core/values/ids'
  import { NO_CATEGORY } from '@project-review/core/values/ids'
  import { BAND_COLOR } from '../commons/band-color'
  import { categoryName } from '../slides/labels'
  import { te } from '../i18n'
  import { fuzzyFilter } from '../editor/fuzzy'
  import { projectWarnings } from '../editor/validation'
  import * as AlertDialog from '../commons/ui/alert-dialog'
  import { Badge } from '../commons/ui/badge'
  import { Button } from '../commons/ui/button'
  import * as DropdownMenu from '../commons/ui/dropdown-menu'
  import { Input } from '../commons/ui/input'
  import type { Dispatch } from './contracts'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    readonly open: (projectId: string) => void
  }

  let { portfolio, dispatch, open }: Props = $props()

  let query = $state('')

  const language = $derived(portfolio.settings.language)

  const matching = $derived(
    fuzzyFilter(portfolio.projects, query, (p) => [p.id, p.name, p.lead, p.sponsor]),
  )
  const matchingIds = $derived(new Set(matching.map((p) => p.id)))

  interface Group {
    readonly ref: GroupRef
    readonly category: Category | UnsortedCategory
    readonly projects: readonly Project[]
  }

  /** Tracked projects, category by category; a category with none is skipped.
   * Membership comes from the projections (orphanProjects/knownCategoryIds) —
   * the screen only filters by search and tracking. */
  const groups = $derived.by((): readonly Group[] => {
    const result: Group[] = []
    for (const category of portfolio.categories) {
      const projects = projectsOfCategory(portfolio, category.id)
        .filter(isTracked)
        .filter((p) => matchingIds.has(p.id))
      if (projects.length > 0) {
        result.push({ ref: { kind: 'category', id: category.id }, category, projects })
      }
    }
    // Orphan `categoryId` values fall back to "À classer" — never dropped.
    const orphans = orphanProjects(portfolio).filter((p) => isTracked(p) && matchingIds.has(p.id))
    if (orphans.length > 0) {
      result.push({ ref: { kind: 'orphans' }, category: UNSORTED_CATEGORY, projects: orphans })
    }
    return result
  })

  const archived = $derived(
    portfolio.projects.filter((p) => isArchived(p) && matchingIds.has(p.id)),
  )

  const totalCount = $derived(portfolio.projects.length)
  const foundCount = $derived(matching.length)
  const searching = $derived(query.trim() !== '')

  function countLabel(n: number): string {
    return n === 1
      ? te('editor.projects.groupCountOne', language)
      : te('editor.projects.groupCount', language, { n })
  }

  /**
   * Move RELATIVE TO THE VISIBLE NEIGHBOUR of the same group: `to` is the
   * neighbour's index in the full `projects` list, which `ProjectMoved`'s splice
   * semantics turn into "right before it" (up) / "right after it" (down).
   */
  function moveProject(project: Project, siblings: readonly Project[], delta: -1 | 1): void {
    const neighbour = siblings[siblings.indexOf(project) + delta]
    if (!neighbour) return
    dispatch({
      type: 'MoveProject',
      id: project.id,
      to: portfolio.projects.indexOf(neighbour),
    })
  }

  /** Delete waits in local pending state; the dialog's Confirm dispatches. */
  let pendingDelete = $state<Project | undefined>(undefined)

  function addProject(): void {
    const project: Project = {
      id: nextProjectId(portfolio.projects),
      name: te('editor.projects.newName', language),
      categoryId: portfolio.categories[0]?.id ?? NO_CATEGORY,
      stage: 'toScope',
      onHold: false,
      goal: '',
      done: [],
      ongoing: [],
      next: [],
      decisions: [],
      milestones: [],
      sheet: 'auto',
    }
    dispatch({ type: 'CreateProject', project, index: portfolio.projects.length })
    open(project.id)
  }

  const ROW_GRID =
    'grid grid-cols-[22px_46px_minmax(0,1fr)_150px_46px_30px_96px_46px_60px_26px_26px] items-center gap-x-2 px-3.5'
</script>

{#snippet row(project: Project, siblings: readonly Project[])}
  {@const gauge = projectGauge(project)}
  {@const decisions = pendingDecisionsOf(project).length}
  {@const warnings = projectWarnings(project)}
  {@const position = siblings.indexOf(project)}
  <div
    class="{ROW_GRID} border-border min-h-[46px] w-full border-b py-1.5 last:border-b-0 even:bg-secondary"
  >
    <span class="inline-flex justify-center">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          class="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-ring inline-flex size-[22px] cursor-pointer items-center justify-center rounded-md text-sm focus-visible:outline-2"
          title={te('editor.menu.actions', language)}
          aria-label="{te('editor.menu.actions', language)} {project.id}">⋯</DropdownMenu.Trigger
        >
        <DropdownMenu.Content align="start">
          <DropdownMenu.Item
            disabled={position <= 0}
            onSelect={() => moveProject(project, siblings, -1)}
            >{te('editor.projects.moveUp', language)}</DropdownMenu.Item
          >
          <DropdownMenu.Item
            disabled={position === siblings.length - 1}
            onSelect={() => moveProject(project, siblings, 1)}
            >{te('editor.projects.moveDown', language)}</DropdownMenu.Item
          >
          <DropdownMenu.Item variant="destructive" onSelect={() => (pendingDelete = project)}
            >{te('editor.projects.delete', language)}</DropdownMenu.Item
          >
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </span>
    <span class="text-(--txt2) text-[12.5px] font-bold tabular-nums">{project.id}</span>
    <span class="text-foreground min-w-0 truncate text-[13.5px]" title={project.name}
      >{project.name}</span
    >
    <span class="flex min-w-0 flex-wrap items-center gap-1">
      <!-- The SAME StageChip as the recap slide — one chip vocabulary, on-hold
           rendering (and its archived-project rule) included. -->
      <StageChip {project} {language} compact />
    </span>
    <HealthDot health={project.health} {language} shape="dot" />
    <span class="text-(--txt2) text-center text-[12.5px] font-semibold"
      >{project.priority ?? t('priority.none', language)}</span
    >
    <span
      class="flex items-center gap-1.5"
      title={gauge.type === 'notAssessed'
        ? te('editor.projects.noProgressBeforeLaunch', language)
        : undefined}
    >
      <span
        class="h-1.5 w-[52px] flex-none overflow-hidden rounded-full bg-[#e6e6e6] dark:bg-white/15"
      >
        {#if gauge.type === 'value'}
          <span
            class="block h-full min-w-1 rounded-full"
            style="width:{gauge.pct}%;background:{BAND_COLOR[gauge.band]}"
          ></span>
        {/if}
      </span>
      <span class="text-(--txt2) text-[11.5px] whitespace-nowrap tabular-nums">
        {gauge.type === 'value'
          ? te('editor.value.pct', language, { n: gauge.pct })
          : t('priority.none', language)}
      </span>
    </span>
    <span
      class="text-primary flex items-center justify-center text-sm font-bold"
      title={decisions > 0 ? te('editor.projects.pendingDecision', language) : undefined}
    >
      {decisions > 0 ? '✓' : ''}
    </span>
    <span
      class="border-input text-muted-foreground inline-flex h-[19px] w-[52px] overflow-hidden rounded-[5px] border text-[9px] font-bold"
      title={te('editor.field.sheet', language)}
    >
      {#each SHEET_MODES as mode (mode)}
        {#if project.sheet === mode}
          <b
            class="bg-(--accent-925) text-primary border-input flex flex-1 items-center justify-center border-r not-italic last:border-r-0"
            title={te(`editor.sheetMode.${mode}`, language)}
          >
            {te(`editor.sheetMode.${mode}.short`, language)}
          </b>
        {:else}
          <i
            class="border-input flex flex-1 items-center justify-center border-r not-italic last:border-r-0"
            title={te(`editor.sheetMode.${mode}`, language)}
          >
            {te(`editor.sheetMode.${mode}.short`, language)}
          </i>
        {/if}
      {/each}
    </span>
    <Button
      variant="ghost"
      size="icon-xs"
      class="text-muted-foreground"
      title={te('editor.projects.edit', language)}
      aria-label="{te('editor.projects.edit', language)} {project.id}"
      onclick={() => open(project.id)}>✎</Button
    >
    {#if warnings.length > 0}
      <span
        class="flex items-center justify-center"
        title={warnings.map((w) => te(w.key, language, w.slots)).join(' · ')}
      >
        <Badge
          class="bg-(--warn-bg) text-(--warn) h-[19px] border-current/30 px-[7px] text-[10.5px] font-bold"
          >{warnings.length}</Badge
        >
      </span>
    {:else}
      <span></span>
    {/if}
  </div>
{/snippet}

<section class="bg-background border-border min-w-0 flex-1 overflow-hidden rounded-lg border">
  <div
    class="border-border flex items-center justify-between gap-4 border-b px-4 py-3.5 max-md:flex-wrap max-md:px-3"
  >
    <div class="relative w-[520px] max-w-full flex-none max-md:w-full">
      <svg
        class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
        <path
          d="M16.5 16.5 21 21"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
      <Input
        class="w-full pl-[38px]"
        type="search"
        bind:value={query}
        placeholder={te('editor.projects.searchPlaceholder', language)}
        aria-label={te('editor.projects.searchLabel', language)}
      />
    </div>
    <span class="text-muted-foreground flex items-center text-xs">
      {#if searching}
        {te('editor.projects.found', language, { n: foundCount, total: totalCount })}
        <Button
          variant="link"
          class="ml-1.5 h-auto p-0 text-xs underline"
          onclick={() => (query = '')}
        >
          {te('editor.projects.clear', language)}
        </Button>
      {:else}
        {te('editor.projects.total', language, { n: totalCount })}
        <Button variant="link" class="ml-1.5 h-auto p-0 text-xs underline" onclick={addProject}>
          {te('editor.projects.add', language)}
        </Button>
      {/if}
    </span>
  </div>

  <!-- The 11-column grid keeps its full metrics on every screen: below its
       natural width the TABLE scrolls sideways inside this container — the
       page body itself never scrolls horizontally. -->
  <div class="overflow-x-auto overscroll-x-contain">
    <div class="min-w-[860px]">
      <div
        class="{ROW_GRID} bg-secondary text-muted-foreground border-border h-8 border-b text-[10.5px] font-bold tracking-[0.05em] uppercase"
      >
        <span></span>
        <span class="overflow-hidden whitespace-nowrap"
          >{te('editor.projects.col.id', language)}</span
        >
        <span class="overflow-hidden whitespace-nowrap"
          >{te('editor.projects.col.project', language)}</span
        >
        <span class="overflow-hidden whitespace-nowrap">{te('editor.field.stage', language)}</span>
        <span class="overflow-hidden whitespace-nowrap">{te('editor.field.health', language)}</span>
        <span class="overflow-hidden whitespace-nowrap"
          >{te('editor.projects.col.priority', language)}</span
        >
        <span class="overflow-hidden whitespace-nowrap"
          >{te('editor.field.progress', language)}</span
        >
        <span class="overflow-hidden whitespace-nowrap"
          >{te('editor.projects.col.decision', language)}</span
        >
        <span
          class="overflow-hidden whitespace-nowrap"
          title={te('editor.projects.col.slideTitle', language)}
          >{te('editor.projects.col.slide', language)}</span
        >
        <span></span>
        <span></span>
      </div>

      {#each groups as group (groupKey(group.ref))}
        <div class="border-secondary border-b-[5px] last-of-type:border-b-0">
          <div
            class="border-border bg-background flex h-9 items-center gap-2 border-b px-3.5 text-[13px]"
          >
            <span
              class="inline-block size-2.5 flex-none rounded-full"
              style="background:{catColor(group.category.color)}"
              aria-hidden="true"
            ></span>
            <span class="text-foreground font-bold">{categoryName(group.category, language)}</span>
            <span class="text-muted-foreground ml-0.5 text-[11.5px]"
              >{countLabel(group.projects.length)}</span
            >
          </div>
          {#each group.projects as project (project.id)}
            {@render row(project, group.projects)}
          {/each}
        </div>
      {/each}

      {#if archived.length > 0}
        <details class="border-secondary group border-b-[5px] last-of-type:border-b-0">
          <summary
            class="border-border bg-background flex h-9 cursor-pointer list-none items-center gap-2 border-b px-3.5 text-[13px] [&::-webkit-details-marker]:hidden"
          >
            <span
              class="text-muted-foreground inline-block w-2.5 text-[10px] transition-transform duration-[120ms] group-open:rotate-90"
              aria-hidden="true">▸</span
            >
            <span
              class="inline-block size-2.5 flex-none rounded-full"
              style="background:var(--av-na)"
              aria-hidden="true"
            ></span>
            <span class="text-(--txt2) font-bold">{te('editor.projects.archived', language)}</span>
            <span class="text-muted-foreground ml-0.5 text-[11.5px]"
              >{countLabel(archived.length)}</span
            >
          </summary>
          {#each archived as project (project.id)}
            {@render row(project, archived)}
          {/each}
        </details>
      {/if}

      {#if groups.length === 0 && archived.length === 0}
        <p class="text-muted-foreground px-4 py-[26px] text-center text-[13px]">
          {searching ? te('editor.projects.none', language) : te('editor.projects.empty', language)}
        </p>
      {/if}
    </div>
  </div>
</section>

<!-- Mounted only while a deletion is pending: Confirm dispatches, anything
     else (Cancel, Escape, overlay) simply drops the intent. -->
{#if pendingDelete}
  {@const doomed = pendingDelete}
  <AlertDialog.Root open onOpenChange={(o) => o || (pendingDelete = undefined)}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>{te('editor.projects.delete', language)}</AlertDialog.Title>
        <AlertDialog.Description>
          {te('editor.menu.deleteConfirm', language, { id: doomed.id })}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel>{te('editor.io.cancel', language)}</AlertDialog.Cancel>
        <AlertDialog.Action
          onclick={() => {
            dispatch({ type: 'DeleteProject', id: doomed.id })
            pendingDelete = undefined
          }}>{te('editor.confirm', language)}</AlertDialog.Action
        >
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
