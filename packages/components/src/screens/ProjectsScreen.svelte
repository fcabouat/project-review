<script lang="ts">
  /**
   * Projects screen — the portfolio table, grouped by category, with the
   * instant fuzzy search. Destructive confirmations use the native dialog —
   * deliberate.
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
    isArchived,
    isTracked,
    orphanProjects,
    pendingDecisionsOf,
    projectGauge,
    projectsOfCategory,
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
      if (projects.length > 0) result.push({ category, projects })
    }
    // Orphan `categoryId` values fall back to "À classer" — never dropped.
    const orphans = orphanProjects(portfolio).filter((p) => isTracked(p) && matchingIds.has(p.id))
    if (orphans.length > 0) result.push({ category: UNSORTED_CATEGORY, projects: orphans })
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

  /** Which row's "⋯" menu is open — at most one at a time. */
  let menuId = $state<string | undefined>(undefined)

  /**
   * Move RELATIVE TO THE VISIBLE NEIGHBOUR of the same group: `to` is the
   * neighbour's index in the full `projects` list, which `ProjectMoved`'s splice
   * semantics turn into "right before it" (up) / "right after it" (down).
   */
  function moveProject(project: Project, siblings: readonly Project[], delta: -1 | 1): void {
    menuId = undefined
    const neighbour = siblings[siblings.indexOf(project) + delta]
    if (!neighbour) return
    dispatch({
      type: 'MoveProject',
      id: project.id,
      to: portfolio.projects.indexOf(neighbour),
    })
  }

  function deleteProject(project: Project): void {
    menuId = undefined
    if (!window.confirm(te('editor.menu.deleteConfirm', language, { id: project.id }))) return
    dispatch({ type: 'DeleteProject', id: project.id })
  }

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
</script>

{#snippet row(project: Project, siblings: readonly Project[])}
  {@const gauge = projectGauge(project)}
  {@const decisions = pendingDecisionsOf(project).length}
  {@const warnings = projectWarnings(project)}
  {@const position = siblings.indexOf(project)}
  <div class="prow">
    <span class="row-menu">
      <button
        class="icon-btn"
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuId === project.id}
        title={te('editor.menu.actions', language)}
        aria-label="{te('editor.menu.actions', language)} {project.id}"
        onclick={(e) => {
          e.stopPropagation()
          menuId = menuId === project.id ? undefined : project.id
        }}>⋯</button
      >
      {#if menuId === project.id}
        <div class="row-menu-pop" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={position <= 0}
            onclick={() => moveProject(project, siblings, -1)}
            >{te('editor.projects.moveUp', language)}</button
          >
          <button
            type="button"
            role="menuitem"
            disabled={position === siblings.length - 1}
            onclick={() => moveProject(project, siblings, 1)}
            >{te('editor.projects.moveDown', language)}</button
          >
          <button
            type="button"
            role="menuitem"
            class="danger"
            onclick={() => deleteProject(project)}>{te('editor.projects.delete', language)}</button
          >
        </div>
      {/if}
    </span>
    <span class="pid">{project.id}</span>
    <span class="pnom" title={project.name}>{project.name}</span>
    <span class="etapecell">
      <!-- The SAME StageChip as the recap slide — one chip vocabulary, on-hold
           rendering (and its archived-project rule) included. -->
      <StageChip {project} {language} compact />
    </span>
    <HealthDot health={project.health} {language} shape="dot" />
    <span class="prio">{project.priority ?? t('priority.none', language)}</span>
    <span
      class="avanc"
      title={gauge.type === 'notAssessed'
        ? te('editor.projects.noProgressBeforeLaunch', language)
        : undefined}
    >
      <span class="bar">
        {#if gauge.type === 'value'}
          <span class="bar-fill" style="--w:{gauge.pct}%;--c:{BAND_COLOR[gauge.band]}"></span>
        {/if}
      </span>
      <span class="pct">
        {gauge.type === 'value'
          ? te('editor.value.pct', language, { n: gauge.pct })
          : t('priority.none', language)}
      </span>
    </span>
    <span
      class="deco"
      title={decisions > 0 ? te('editor.projects.pendingDecision', language) : undefined}
    >
      {decisions > 0 ? '✓' : ''}
    </span>
    <span class="ficheseg" title={te('editor.field.sheet', language)}>
      {#each SHEET_MODES as mode (mode)}
        {#if project.sheet === mode}
          <b title={te(`editor.sheetMode.${mode}`, language)}>
            {te(`editor.sheetMode.${mode}.short`, language)}
          </b>
        {:else}
          <i title={te(`editor.sheetMode.${mode}`, language)}>
            {te(`editor.sheetMode.${mode}.short`, language)}
          </i>
        {/if}
      {/each}
    </span>
    <button
      class="icon-btn"
      type="button"
      title={te('editor.projects.edit', language)}
      aria-label="{te('editor.projects.edit', language)} {project.id}"
      onclick={() => open(project.id)}>✎</button
    >
    {#if warnings.length > 0}
      <span class="deco" title={warnings.map((w) => te(w.key, language, w.slots)).join(' · ')}>
        <span class="softcheck-badge">{warnings.length}</span>
      </span>
    {:else}
      <span></span>
    {/if}
  </div>
{/snippet}

<!-- Any click outside the "⋯" button closes the open row menu. -->
<svelte:window onclick={() => (menuId = undefined)} />

<section class="panel-table">
  <div class="panel-header">
    <div class="field-search">
      <svg class="loupe" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
        <path
          d="M16.5 16.5 21 21"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
      <input
        class="input"
        type="search"
        bind:value={query}
        placeholder={te('editor.projects.searchPlaceholder', language)}
        aria-label={te('editor.projects.searchLabel', language)}
      />
    </div>
    <span class="sub search-status">
      {#if searching}
        {te('editor.projects.found', language, { n: foundCount, total: totalCount })}
        <button class="link-btn" type="button" onclick={() => (query = '')}>
          {te('editor.projects.clear', language)}
        </button>
      {:else}
        {te('editor.projects.total', language, { n: totalCount })}
        <button class="link-btn" type="button" onclick={addProject}>
          {te('editor.projects.add', language)}
        </button>
      {/if}
    </span>
  </div>

  <div class="ptable-head">
    <span></span>
    <span>{te('editor.projects.col.id', language)}</span>
    <span>{te('editor.projects.col.project', language)}</span>
    <span>{te('editor.field.stage', language)}</span>
    <span>{te('editor.field.health', language)}</span>
    <span>{te('editor.projects.col.priority', language)}</span>
    <span>{te('editor.field.progress', language)}</span>
    <span>{te('editor.projects.col.decision', language)}</span>
    <span title={te('editor.projects.col.slideTitle', language)}
      >{te('editor.projects.col.slide', language)}</span
    >
    <span></span>
    <span></span>
  </div>

  {#each groups as group (group.category.id)}
    <div class="ptable-group">
      <div class="ptable-grouphead">
        <span class="cat-dot" style="--c:{catColor(group.category.color)}" aria-hidden="true"
        ></span>
        <span class="gname">{categoryName(group.category, language)}</span>
        <span class="gcount">{countLabel(group.projects.length)}</span>
      </div>
      {#each group.projects as project (project.id)}
        {@render row(project, group.projects)}
      {/each}
    </div>
  {/each}

  {#if archived.length > 0}
    <details class="ptable-group">
      <summary class="ptable-grouphead">
        <span class="chev" aria-hidden="true">▸</span>
        <span class="cat-dot" style="--c:var(--av-na)" aria-hidden="true"></span>
        <span class="gname">{te('editor.projects.archived', language)}</span>
        <span class="gcount">{countLabel(archived.length)}</span>
      </summary>
      {#each archived as project (project.id)}
        {@render row(project, archived)}
      {/each}
    </details>
  {/if}

  {#if groups.length === 0 && archived.length === 0}
    <p class="table-empty">
      {searching ? te('editor.projects.none', language) : te('editor.projects.empty', language)}
    </p>
  {/if}
</section>
