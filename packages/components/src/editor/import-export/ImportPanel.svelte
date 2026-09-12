<script lang="ts">
  /** Import tab panel: strict parse of a dropped, browsed or pasted file, its full report, then one command — ReplacePortfolio or MergeProjects — once the user confirms. */
  import { untrack } from 'svelte'
  import {
    readPortfolioJson,
    type ParseError,
    type ReadOutcome,
  } from '@project-review/core/services/parse'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { MAX_IMPORT_BYTES } from '@project-review/core/model/budget'
  import { decide, type MergeProjects } from '@project-review/core/commands'
  import { mergeReport, type MergeReport } from '@project-review/core/events'
  import {
    ERROR_REPORT_FILE_NAME,
    errorReportText,
    isTruncated,
    shownErrors,
  } from '../error-report'
  import type { Dispatch } from '../../contracts'
  import { te } from '../../i18n'
  import { Button } from '../../commons/ui/button'
  import { Checkbox } from '../../commons/ui/checkbox'
  import { Textarea } from '../../commons/ui/textarea'
  import * as RadioGroup from '../../commons/ui/radio-group'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    readonly close: () => void
    /** Opening content of the import box, and the mode pre-selected under it
     * (story/testing seams — the user path is drop, browse or paste, then
     * choose). */
    readonly prefill?: string
    readonly prefillMode?: 'replace' | 'merge'
  }

  let { portfolio, dispatch, close, prefill, prefillMode }: Props = $props()

  /**
   * Checked by default: the import replaces the CONTENT (review,
   * categories, projects, free slides) and keeps the local settings — identity,
   * theme, logo, language, display. Unchecked = take the whole file.
   */
  let keepSettings = $state(true)
  /** Import mode — 'replace' is the historic path and the default. */
  let mode = $state<'replace' | 'merge'>(untrack(() => prefillMode ?? 'replace'))
  let source = $state('')
  let dragging = $state(false)
  /** `undefined` until something has been submitted — no report on an empty box. */
  let result = $state<ReadOutcome | undefined>(undefined)
  /** Figures of an APPLIED merge — the after-report the panel shows, read off
   * the event `dispatch` returns: what the panel announces is exactly what
   * entered the log. */
  let mergedDone = $state<MergeReport | undefined>(undefined)

  const language = $derived(portfolio.settings.language)

  function analyse(text: string): void {
    source = text
    mergedDone = undefined
    if (text.trim() === '') {
      result = undefined
      return
    }
    // Size cap, JSON.parse, strict parse — the whole path is the core's
    // (`readPortfolioJson`); the dialog only renders the outcome.
    result = readPortfolioJson(text)
  }

  // Component init: the seam fills the box once (opening value, like `tab`).
  const opening = untrack(() => prefill)
  if (opening !== undefined) analyse(opening)

  /** The merge intent for the parsed file — only projects and categories
   * matter to a merge (the file's review/settings/free slides stay ignored). */
  const mergeCommand = $derived.by((): MergeProjects | undefined =>
    result?.ok
      ? {
          type: 'MergeProjects',
          projects: result.portfolio.projects,
          categories: result.portfolio.categories,
        }
      : undefined,
  )
  // `decide` is pure: previewing the merge is deciding it without dispatching.
  const mergeEvent = $derived(
    mergeCommand === undefined ? undefined : decide(portfolio, mergeCommand),
  )
  const mergePreview = $derived(
    mergeEvent?.type === 'ProjectsMerged' ? mergeReport(mergeEvent) : undefined,
  )

  /** Localized wording of one contract violation. */
  function errorMessage(error: ParseError): string {
    return te(`editor.error.${error.code}`, language, error.params)
  }

  async function readFile(file: File | undefined): Promise<void> {
    if (!file) return
    // THE SIZE IS JUDGED ON THE DECLARATION, BEFORE ONE BYTE IS READ. `text()`
    // allocates the whole file as a string: dropped a multi-gigabyte archive,
    // the tab used to die of the read itself, long before the length check
    // that would have refused it. A file declaring more bytes than the format
    // can possibly hold cannot be a portfolio, so it is refused unread — and
    // with the very verdict the length check would have given.
    if (file.size > MAX_IMPORT_BYTES) {
      source = ''
      mergedDone = undefined
      result = { ok: false, refusal: 'tooLarge' }
      return
    }
    analyse(await file.text())
  }

  /** The whole report, as the file the list cannot be. Built on the click. */
  function downloadReport(): void {
    if (result === undefined || result.ok || 'refusal' in result) return
    const url = URL.createObjectURL(
      new Blob([errorReportText(result.errors, errorMessage)], { type: 'text/plain' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = ERROR_REPORT_FILE_NAME
    link.click()
    URL.revokeObjectURL(url)
  }

  function confirmImport(): void {
    if (!result?.ok) return
    if (mode === 'merge') {
      if (mergeCommand === undefined) return
      // Undoable like everything else: one ProjectsMerged on the past stack.
      // The report derives from the RECORDED event, not from the preview —
      // `dispatch` returns it (or `undefined` for a merge void of effect).
      const event = dispatch(mergeCommand)
      if (event?.type === 'ProjectsMerged') mergedDone = mergeReport(event)
      return
    }
    const next = keepSettings
      ? { ...result.portfolio, settings: portfolio.settings }
      : result.portfolio
    // Undoable like everything else: one ReplacePortfolio on the past stack.
    dispatch({ type: 'ReplacePortfolio', portfolio: next })
    close()
  }
</script>

<div class="p-5">
  <div
    class="{dragging
      ? 'border-primary bg-accent text-accent-foreground'
      : 'text-muted-foreground bg-secondary border-[#c7c7cc] dark:border-(--border)'} mb-3 rounded-lg border-[1.5px] border-dashed p-5 text-center text-[13px]"
    role="presentation"
    ondragover={(e) => {
      e.preventDefault()
      dragging = true
    }}
    ondragleave={() => (dragging = false)}
    ondrop={(e) => {
      e.preventDefault()
      dragging = false
      void readFile(e.dataTransfer?.files[0])
    }}
  >
    {te('editor.io.dropzone', language)}
    <label class="text-primary ml-1.5 cursor-pointer font-semibold underline">
      {te('editor.io.browse', language)}
      <input
        type="file"
        accept="application/json,.json"
        class="absolute h-px w-px opacity-0"
        onchange={(e) => void readFile(e.currentTarget.files?.[0])}
      />
    </label>
  </div>

  <Textarea
    class="text-(--txt2) field-sizing-fixed bg-[#fafafa] font-mono text-xs leading-[1.55] dark:bg-white/5"
    rows={6}
    aria-label={te('editor.io.paste', language)}
    value={source}
    oninput={(e) => analyse(e.currentTarget.value)}
  ></Textarea>

  {#if result}
    <div class="bg-secondary mt-3.5 rounded-md px-3.5 py-3">
      {#if result.ok}
        <p class="text-(--ok) text-[13px] font-bold">
          {te('editor.io.reportOk', language, {
            projects: result.portfolio.projects.length,
            categories: result.portfolio.categories.length,
            slides: result.portfolio.freeSlides.length,
          })}
        </p>
      {:else if 'refusal' in result}
        <p class="text-destructive text-[13px] font-bold">
          {te('editor.io.refused', language)} — {te(`editor.error.${result.refusal}`, language)}
        </p>
      {:else}
        <p class="text-destructive mb-2 text-[13px] font-bold">
          {te('editor.io.refused', language)} — {te('editor.io.errorCount', language, {
            n: result.errors.length,
          })}
        </p>
        <!-- The count above is the WHOLE report; this list is bounded. A
             hundred thousand list items say the same sentence a hundred
             thousand times and cost the browser everything. -->
        <ul class="m-0 flex max-h-[190px] list-none flex-col gap-1.5 overflow-auto p-0">
          {#each shownErrors(result.errors) as error, i (i)}
            <li class="text-(--warn) text-[12.5px]">
              — {#if error.path}{error.path} :
              {/if}{errorMessage(error)}
            </li>
          {/each}
        </ul>
        {#if isTruncated(result.errors)}
          <p class="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
            {te('editor.io.errorListCapped', language, { n: shownErrors(result.errors).length })}
            <Button variant="outline" size="sm" onclick={downloadReport}>
              {te('editor.io.errorReport', language)}
            </Button>
          </p>
        {/if}
      {/if}
    </div>
  {/if}

  {#if mergedDone}
    <div class="bg-secondary mt-3.5 rounded-md px-3.5 py-3">
      <p class="text-(--ok) text-[13px] font-bold">
        {te('editor.io.mergeDone', language, {
          n: mergedDone.replaced,
          m: mergedDone.added,
        })}
      </p>
    </div>
  {:else if result?.ok}
    <fieldset class="border-border mt-3 flex flex-col gap-[7px] rounded-md border px-3.5 pt-1 pb-3">
      <legend class="text-(--txt2) px-1 text-xs font-bold"
        >{te('editor.io.modeLegend', language)}</legend
      >
      <RadioGroup.Root
        class="flex flex-col gap-[7px]"
        value={mode}
        onValueChange={(v) => (mode = v as 'replace' | 'merge')}
      >
        <label class="flex cursor-pointer items-center gap-2 text-[13px]">
          <RadioGroup.Item value="replace" />
          <span>{te('editor.io.mode.replace', language)}</span>
        </label>
        <label class="flex cursor-pointer items-center gap-2 text-[13px]">
          <RadioGroup.Item value="merge" />
          <span>{te('editor.io.mode.merge', language)}</span>
        </label>
      </RadioGroup.Root>
    </fieldset>

    {#if mode === 'merge'}
      <!-- The names AND the figures come from the DECIDED event, before
           any dispatch: what the preview announces is exactly what the
           merge would record. `before.projects` is the present side —
           the very versions the incoming homonyms would overwrite. -->
      {@const replaced = mergeEvent?.type === 'ProjectsMerged' ? mergeEvent.before.projects : []}
      {#if replaced.length > 0}
        <div class="text-(--txt2) mt-2.5 text-[12.5px]">
          {te('editor.io.mergeReplacedList', language)}
          <ul class="mt-1 max-h-[120px] overflow-auto pl-4">
            {#each replaced as entry (entry.value.id)}
              <li><b class="font-bold">{entry.value.id}</b> · {entry.value.name}</li>
            {/each}
          </ul>
        </div>
      {/if}
      <p class="mt-2.5 text-[13px] font-bold">
        {#if mergePreview}
          {te('editor.io.mergePreview', language, {
            n: mergePreview.replaced,
            m: mergePreview.added,
          }) +
            (mergePreview.createdCategories > 0
              ? te('editor.io.mergePreviewCategories', language, {
                  k: mergePreview.createdCategories,
                })
              : '')}
        {:else}
          {te('editor.io.mergeNoEffect', language)}
        {/if}
      </p>
      <p class="text-muted-foreground mt-1 text-[11.5px]">{te('editor.io.mergeHint', language)}</p>
    {:else}
      <label class="mt-2.5 flex cursor-pointer items-center gap-2 text-[13px]">
        <Checkbox bind:checked={keepSettings} />
        <span>{te('editor.io.keepSettings', language)}</span>
      </label>
    {/if}
  {/if}

  <div class="mt-4 flex justify-end gap-2.5">
    {#if mergedDone}
      <Button onclick={close}>
        {te('editor.io.close', language)}
      </Button>
    {:else}
      <Button variant="outline" onclick={close}>
        {te('editor.io.cancel', language)}
      </Button>
      <Button
        disabled={!result?.ok || (mode === 'merge' && mergePreview === undefined)}
        onclick={confirmImport}
        >{te(mode === 'merge' ? 'editor.io.merge' : 'editor.io.replace', language)}</Button
      >
    {/if}
  </div>
</div>
