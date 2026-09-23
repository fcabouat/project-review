<script lang="ts">
  /** Project editing: immutable identity, optional business reference, independent fields. */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Project } from '@project-review/core/model/project'
  import { categoryOf, projectById } from '@project-review/core/projections'
  import { categoryId } from '@project-review/core/values/ids'
  import { catColor } from '../commons/cat-color'
  import type { ProjectScalarField } from '@project-review/core/events'
  import { te, type LabelKey } from '../i18n'
  import { projectWarnings } from '../editor/validation'
  import Icon from '../commons/Icon.svelte'
  import { Button } from '../commons/ui/button'
  import * as Select from '../commons/ui/select'
  import * as Tabs from '../commons/ui/tabs'
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
    /** Replaces the current entry — redirects (unknown id). */
    readonly replaceRoute: (route: Route) => void
    readonly readOnly?: boolean
  }

  let { portfolio, dispatch, projectId, navigate, replaceRoute, readOnly = false }: Props = $props()

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

  const TABS: readonly { readonly id: Tab; readonly key: LabelKey }[] = [
    { id: 'state', key: 'editor.tab.state' },
    { id: 'narrative', key: 'editor.tab.narrative' },
    { id: 'decisions', key: 'editor.tab.decisions' },
    { id: 'milestones', key: 'editor.tab.milestones' },
    { id: 'options', key: 'editor.tab.options' },
  ]

  /** One scalar field of the project — one command, typed by the field. */
  function set<F extends ProjectScalarField>(field: F, after: Project[F]): void {
    if (!project || readOnly) return
    dispatch({ type: 'ChangeProjectField', id: project.id, field, after } as never)
  }

  const category = $derived(project ? categoryOf(portfolio, project.categoryId) : undefined)

  const tabTrigger =
    'text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-primary ' +
    'hover:text-(--txt2) h-auto flex-none grow-0 rounded-none border-x-0 border-t-0 border-b-2 ' +
    'border-transparent bg-transparent px-3.5 pt-[13px] pb-[11px] text-[13px] font-bold ' +
    'whitespace-nowrap shadow-none data-[state=active]:shadow-none'
</script>

{#if !project}
  <p class="text-muted-foreground px-4 py-[26px] text-center text-[13px]">
    {te('editor.sheet.missing', language)}
  </p>
{:else}
  <div
    class="border-border bg-background flex flex-col items-stretch gap-2.5 rounded-t-lg border border-b-0 px-[22px] py-4 max-md:px-3"
  >
    <nav class="text-muted-foreground text-xs" aria-label={te('editor.sheet.breadcrumb', language)}>
      <Button variant="link" class="h-auto p-0 text-xs underline" onclick={back}>
        {te('editor.sheet.breadcrumb', language)}
      </Button>
      <span class="text-muted-foreground mx-1.5" aria-hidden="true">/</span>
      <span class="text-(--txt2) font-semibold">{project.name}</span>
    </nav>
    <div class="flex items-start gap-[18px] max-md:flex-col max-md:items-stretch max-md:gap-3">
      <fieldset disabled={readOnly} class="flex min-w-0 flex-1 gap-4 max-md:flex-col max-md:gap-3">
        <div class="w-40 flex-none max-md:w-full">
          <FieldText
            {language}
            label={te('editor.field.reference', language)}
            draftKey={JSON.stringify(['project', project.id, 'reference'])}
            value={project.reference}
            commit={(v) => set('reference', v?.trim() || undefined)}
          />
        </div>

        <div class="min-w-0 flex-1">
          <FieldText
            {language}
            label={te('editor.field.name', language)}
            draftKey={JSON.stringify(['project', project.id, 'name'])}
            value={project.name}
            capacity="projectName"
            commit={(v) => set('name', v ?? '')}
          />
        </div>

        <div class="flex w-[210px] flex-none flex-col max-md:w-full">
          <span class="text-(--txt2) mb-[5px] text-[12.5px] font-semibold"
            >{te('editor.field.categoryId', language)}</span
          >
          <Select.Root
            type="single"
            value={project.categoryId}
            onValueChange={(v) => set('categoryId', categoryId(v) ?? project.categoryId)}
          >
            <Select.Trigger
              class="w-full"
              aria-label={te('editor.field.categoryId', language)}
              style={category ? `border-left:4px solid ${catColor(category.color)}` : undefined}
            >
              <span class="truncate">{category?.name ?? project.categoryId}</span>
            </Select.Trigger>
            <Select.Content>
              {#each portfolio.categories as c (c.id)}
                <Select.Item value={c.id} label={c.name} />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      </fieldset>
      <div class="flex flex-none flex-col">
        <!-- Keep the action aligned to the controls' input row while the
             name field's counter remains below its input. -->
        <span class="text-(--txt2) invisible mb-[5px] text-[12.5px] font-semibold"
          >{te('editor.field.name', language)}</span
        >
        <Button onclick={() => (previewing = true)}>
          <Icon name="eye-line" />
          {te('editor.preview.button', language)}
        </Button>
      </div>
    </div>
  </div>

  <Tabs.Root value={tab} onValueChange={(v) => (tab = v as Tab)}>
    <Tabs.List
      variant="line"
      class="border-border bg-background h-auto w-full justify-start gap-0.5 overflow-x-auto rounded-none border-x border-b p-0 px-[22px] max-md:px-3"
    >
      {#each TABS as entry (entry.id)}
        <Tabs.Trigger value={entry.id} class={tabTrigger}>{te(entry.key, language)}</Tabs.Trigger>
      {/each}
    </Tabs.List>

    <fieldset disabled={readOnly} class="contents">
      <div class="flex flex-col gap-5 pt-0">
        {#if warnings.length > 0}
          <ul
            class="bg-(--warn-bg) border-(--warn)/30 m-0 flex list-none flex-col gap-[5px] rounded-md border px-3 py-2.5"
          >
            {#each warnings as warning, i (i)}
              <li class="text-(--warn) text-xs font-semibold">
                {te(warning.key, language, warning.slots)}
              </li>
            {/each}
          </ul>
        {/if}

        <Tabs.Content value="state"><StateTab {project} {language} {set} /></Tabs.Content>
        <Tabs.Content value="narrative">
          <NarrativeTab {project} {language} {dispatch} {set} />
        </Tabs.Content>
        <Tabs.Content value="decisions"
          ><DecisionsTab {project} {language} {dispatch} /></Tabs.Content
        >
        <Tabs.Content value="milestones">
          <MilestonesTab {project} {portfolio} {language} {dispatch} {set} />
        </Tabs.Content>
        <Tabs.Content value="options"><OptionsTab {project} {language} {set} /></Tabs.Content>
      </div>
    </fieldset>
  </Tabs.Root>

  <div class="text-muted-foreground mt-3.5 flex items-center justify-between text-xs">
    <span>{te('editor.sheet.continuous', language)}</span>
    <Button variant="link" class="h-auto p-0 text-xs underline" onclick={back}
      >{te('editor.sheet.back', language)}</Button
    >
  </div>

  {#if previewing}
    <SlidePreviewDialog
      {portfolio}
      slide={{ type: 'sheet', projectId: project.id }}
      subject={te('editor.preview.subject.sheet', language, { id: project.name })}
      close={() => (previewing = false)}
    />
  {/if}
{/if}
