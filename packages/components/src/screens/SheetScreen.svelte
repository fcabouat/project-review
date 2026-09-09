<script lang="ts">
  /**
   * Sheet screen — the project sheet, in TABS rather than one long scroll: "Frame & status
   * · Narrative · Decisions · Milestones & dates · Options". Renumbering runs
   * in the vendored Dialog: a local draft, and the refusal surfaces inline in
   * the same dialog instead of a second alert.
   *
   * Field ↔ command, at blur: `decide` reads the `before` and drops the
   * scalar no-ops. The WHOLESALE replacements (lists, milestones, decisions)
   * keep their local equality guards — `decide` deliberately lets deep payloads
   * through, so the emitter is the one place that can spare the redo stack.
   *
   * The id is NOT a field: it only moves through `RenumberProject`, and the
   * uniqueness check lives in `decide` — a refused renumbering comes back as
   * `undefined` and surfaces as the inline refusal below.
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
  import { Button } from '../commons/ui/button'
  import * as Dialog from '../commons/ui/dialog'
  import { Input } from '../commons/ui/input'
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
   * exactly when the dialog shows the refusal, inline.
   */
  let renumbering = $state(false)
  let renumberDraft = $state('')
  /** Id of the last refused proposal — the inline message names it. */
  let renumberTaken = $state<string | undefined>(undefined)

  function openRenumber(): void {
    if (!project) return
    renumberDraft = project.id
    renumberTaken = undefined
    renumbering = true
  }

  function confirmRenumber(): void {
    if (!project) return
    const next = asProjectId(renumberDraft.trim())
    if (!next || next === project.id) {
      renumbering = false
      return
    }
    const event = dispatch({ type: 'RenumberProject', id: project.id, newId: next })
    if (event === undefined) {
      renumberTaken = next
      return
    }
    renumbering = false
    // The route addresses the OLD id: swap it for the new one in place.
    replaceRoute({ name: 'sheet', id: next })
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
      <span class="text-(--txt2) font-semibold">{project.id}</span>
    </nav>
    <div class="flex items-end gap-[18px] max-md:flex-col max-md:items-stretch max-md:gap-3">
      <div class="flex min-w-0 flex-1 gap-4 max-md:flex-col max-md:gap-3">
        <label class="flex w-32 flex-none flex-col max-md:w-full">
          <span class="text-(--txt2) mb-[5px] text-[12.5px] font-semibold"
            >{te('editor.field.id', language)}</span
          >
          <span class="flex items-center gap-1.5">
            <Input
              class="read-only:text-(--txt2) read-only:bg-[#fafafa] dark:read-only:bg-white/5"
              value={project.id}
              readonly
              title={te('editor.sheet.idLocked', language)}
              aria-label={te('editor.field.id', language)}
            />
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground"
              title={te('editor.sheet.renumber', language)}
              aria-label={te('editor.sheet.renumber', language)}
              onclick={openRenumber}>✎</Button
            >
          </span>
        </label>

        <div class="min-w-0 flex-1">
          <FieldText
            {language}
            label={te('editor.field.name', language)}
            value={project.name}
            max={60}
            commit={(v) => set('name', v ?? project.id)}
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
      </div>
      <Button onclick={() => (previewing = true)}>
        <Icon name="eye-line" />
        {te('editor.preview.button', language)}
      </Button>
    </div>
  </div>

  <Tabs.Root value={tab} onValueChange={(v) => (tab = v as Tab)}>
    <Tabs.List
      class="border-border bg-background h-auto w-full justify-start gap-0.5 overflow-x-auto rounded-none border-x border-b p-0 px-[22px] max-md:px-3"
    >
      {#each TABS as entry (entry.id)}
        <Tabs.Trigger value={entry.id} class={tabTrigger}>{te(entry.key, language)}</Tabs.Trigger>
      {/each}
    </Tabs.List>

    <div class="flex flex-col gap-5 pt-5">
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
      <Tabs.Content value="decisions"><DecisionsTab {project} {language} {dispatch} /></Tabs.Content
      >
      <Tabs.Content value="milestones">
        <MilestonesTab {project} {portfolio} {language} {dispatch} {set} />
      </Tabs.Content>
      <Tabs.Content value="options"><OptionsTab {project} {language} {set} /></Tabs.Content>
    </div>
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
      subject={te('editor.preview.subject.sheet', language, { id: project.id })}
      close={() => (previewing = false)}
    />
  {/if}

  <!-- Renumbering dialog: one Input, Confirm dispatches; a refused id keeps
       the dialog open and says which id is taken. -->
  {#if renumbering}
    <Dialog.Root open onOpenChange={(o) => o || (renumbering = false)}>
      <Dialog.Content class="w-[420px]">
        <Dialog.Header>
          <Dialog.Title>{te('editor.sheet.renumber', language)}</Dialog.Title>
          <Dialog.Description>
            {te('editor.sheet.renumberPrompt', language, { id: project.id })}
          </Dialog.Description>
        </Dialog.Header>
        <Input
          bind:value={renumberDraft}
          aria-label={te('editor.field.id', language)}
          onkeydown={(e) => {
            if (e.key === 'Enter') confirmRenumber()
          }}
        />
        {#if renumberTaken}
          <p class="text-destructive text-xs font-semibold" role="alert">
            {te('editor.sheet.renumberTaken', language, { id: renumberTaken })}
          </p>
        {/if}
        <Dialog.Footer>
          <Button variant="outline" onclick={() => (renumbering = false)}>
            {te('editor.io.cancel', language)}
          </Button>
          <Button onclick={confirmRenumber}>{te('editor.confirm', language)}</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  {/if}
{/if}
