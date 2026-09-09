<script lang="ts">
  /**
   * Sheet screen — the project sheet, in TABS rather than one long scroll: "Frame & status
   * · Narrative · Decisions · Milestones & dates · Options". Renumbering and
   * its refusal use the native prompt/alert dialogs — deliberate.
   *
   * Field ↔ command, at blur: `decide` reads the `before` and drops the
   * scalar no-ops. The WHOLESALE replacements (lists, milestones, decisions)
   * keep their local equality guards — `decide` deliberately lets deep payloads
   * through, so the emitter is the one place that can spare the redo stack.
   *
   * The id is NOT a field: it only moves through `RenumberProject`, and the
   * uniqueness check lives in `decide` — a refused renumbering comes back as
   * `undefined` and surfaces as the alert below.
   *
   * The screen is addressed by `#/sheet/{id}`: the project id comes from the
   * route. Pure screen (screens contract, `contracts.ts`): navigation goes out
   * through the two callbacks — `navigate` pushes a history entry (back to the
   * table), `replaceRoute` swaps the current one (unknown id, renumbering).
   *
   * Each tab's body lives in its own component under `screens/sheet/`.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Project } from '@project-review/core/model/project'
  import { categoryOf, projectById } from '@project-review/core/projections'
  import { categoryId, projectId as asProjectId } from '@project-review/core/values/ids'
  import { catColor } from '../commons/cat-color'
  import type { ProjectScalarField } from '@project-review/core/events'
  import { te } from '../i18n'
  import { projectWarnings } from '../editor/validation'
  import Icon from '../commons/Icon.svelte'
  import SlidePreviewDialog from '../editor/SlidePreviewDialog.svelte'
  import FieldText from '../editor/FieldText.svelte'
  import StateTab from './sheet/StateTab.svelte'
  import NarrativeTab from './sheet/NarrativeTab.svelte'
  import DecisionsTab from './sheet/DecisionsTab.svelte'
  import MilestonesTab from './sheet/MilestonesTab.svelte'
  import OptionsTab from './sheet/OptionsTab.svelte'
  import type { Dispatch, Route } from './contracts'

  type Tab = 'state' | 'narrative' | 'decisions' | 'milestones' | 'options'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    /** From the route `#/sheet/{id}` — the shell passes it down. */
    readonly projectId: string
    /** Pushes a new history entry — the `editor.sheet.back` button. */
    readonly navigate: (route: Route) => void
    /** Replaces the current entry — redirects (unknown id, renumbering). */
    readonly replaceRoute: (route: Route) => void
  }

  let { portfolio, dispatch, projectId, navigate, replaceRoute }: Props = $props()

  let tab = $state<Tab>('state')
  /** Mounted only while open: a closed preview renders no slide at all. */
  let previewing = $state(false)

  const language = $derived(portfolio.settings.language)
  const project = $derived(projectById(portfolio, projectId))
  const warnings = $derived(project ? projectWarnings(project) : [])

  // Unknown id (deleted project, hand-typed hash): back to the table, without
  // piling a dead entry onto the browser history.
  $effect(() => {
    if (!project) replaceRoute({ name: 'projects' })
  })

  function back(): void {
    navigate({ name: 'projects' })
  }

  const TABS: readonly { readonly id: Tab; readonly key: string }[] = [
    { id: 'state', key: 'editor.tab.state' },
    { id: 'narrative', key: 'editor.tab.narrative' },
    { id: 'decisions', key: 'editor.tab.decisions' },
    { id: 'milestones', key: 'editor.tab.milestones' },
    { id: 'options', key: 'editor.tab.options' },
  ]

  /** One scalar field of the project — one command, typed by the field. */
  function set<F extends ProjectScalarField>(field: F, after: Project[F]): void {
    if (!project) return
    dispatch({ type: 'ChangeProjectField', id: project.id, field, after } as never)
  }

  /**
   * Renumbering: the ONE way an id changes. Uniqueness is `decide`'s check —
   * a refused command records nothing and comes back `undefined`, which is
   * exactly when the user needs the alert.
   */
  function renumber(): void {
    if (!project) return
    const proposed = window.prompt(
      te('editor.sheet.renumberPrompt', language, { id: project.id }),
      project.id,
    )
    const next = asProjectId(proposed?.trim() ?? '')
    if (!next || next === project.id) return
    const event = dispatch({ type: 'RenumberProject', id: project.id, newId: next })
    if (event === undefined) {
      window.alert(te('editor.sheet.renumberTaken', language, { id: next }))
      return
    }
    // The route addresses the OLD id: swap it for the new one in place.
    replaceRoute({ name: 'sheet', id: next })
  }

  const category = $derived(project ? categoryOf(portfolio, project.categoryId) : undefined)
</script>

{#if !project}
  <p class="table-empty">{te('editor.sheet.missing', language)}</p>
{:else}
  <div class="appbar appbar-e2">
    <nav class="breadcrumb">
      <button class="link-btn" type="button" onclick={back}>
        {te('editor.sheet.breadcrumb', language)}
      </button>
      <span class="sep">/</span>
      <span class="current">{project.id}</span>
    </nav>
    <div class="e2-bar-main">
      <div class="e2-head-fields">
        <label class="field field-id">
          <span>{te('editor.field.id', language)}</span>
          <span style="display:flex;gap:6px;align-items:center">
            <input
              class="input"
              value={project.id}
              readonly
              title={te('editor.sheet.idLocked', language)}
              aria-label={te('editor.field.id', language)}
            />
            <button
              class="icon-btn"
              type="button"
              title={te('editor.sheet.renumber', language)}
              aria-label={te('editor.sheet.renumber', language)}
              onclick={renumber}>✎</button
            >
          </span>
        </label>

        <div class="field field-name">
          <FieldText
            {language}
            label={te('editor.field.name', language)}
            value={project.name}
            max={60}
            commit={(v) => set('name', v ?? project.id)}
          />
        </div>

        <div class="field field-cat">
          <span>{te('editor.field.categoryId', language)}</span>
          <select
            class="select-trigger"
            value={project.categoryId}
            aria-label={te('editor.field.categoryId', language)}
            onchange={(e) =>
              set('categoryId', categoryId(e.currentTarget.value) ?? project.categoryId)}
            style={category ? `border-left:4px solid ${catColor(category.color)}` : undefined}
          >
            {#each portfolio.categories as c (c.id)}
              <option value={c.id}>{c.name}</option>
            {/each}
          </select>
        </div>
      </div>
      <button class="btn btn-primary" type="button" onclick={() => (previewing = true)}>
        <Icon name="eye-line" />
        {te('editor.preview.button', language)}
      </button>
    </div>
  </div>

  <div class="etabs" role="tablist">
    {#each TABS as entry (entry.id)}
      <button
        class="etab-label"
        class:active={tab === entry.id}
        type="button"
        role="tab"
        aria-selected={tab === entry.id}
        onclick={() => (tab = entry.id)}>{te(entry.key, language)}</button
      >
    {/each}
  </div>

  <div class="e2-body">
    {#if warnings.length > 0}
      <ul class="softcheck">
        {#each warnings as warning, i (i)}
          <li>{te(warning.key, language, warning.slots)}</li>
        {/each}
      </ul>
    {/if}

    {#if tab === 'state'}
      <StateTab {project} {language} {set} />
    {:else if tab === 'narrative'}
      <NarrativeTab {project} {language} {dispatch} {set} />
    {:else if tab === 'decisions'}
      <DecisionsTab {project} {language} {dispatch} />
    {:else if tab === 'milestones'}
      <MilestonesTab {project} {portfolio} {language} {dispatch} {set} />
    {:else}
      <OptionsTab {project} {language} {set} />
    {/if}
  </div>

  <div
    style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted)"
  >
    <span>{te('editor.sheet.continuous', language)}</span>
    <button class="link-btn" type="button" onclick={back}
      >{te('editor.sheet.back', language)}</button
    >
  </div>

  {#if previewing}
    <SlidePreviewDialog
      {portfolio}
      slide={{ type: 'sheet', projectId: project.id }}
      subject={te('editor.preview.subject.sheet', language, { id: project.id })}
      close={() => (previewing = false)}
    />
  {/if}
{/if}
