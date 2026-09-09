<script lang="ts">
  /** Import tab panel: strict parse of a dropped, browsed or pasted file, its full report, then one command — ReplacePortfolio or MergeProjects — once the user confirms. */
  import { untrack } from 'svelte'
  import {
    readPortfolioJson,
    type ParseError,
    type ReadOutcome,
  } from '@project-review/core/services/parse'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { decide, type MergeProjects } from '@project-review/core/commands'
  import { mergeReport, type MergeReport } from '@project-review/core/events'
  import type { Dispatch } from '../../contracts'
  import { te } from '../../i18n'

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
    analyse(await file.text())
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

<div class="modal-panel">
  <div
    class="dropzone"
    class:over={dragging}
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
    <label class="link-btn" style="cursor:pointer">
      {te('editor.io.browse', language)}
      <input
        type="file"
        accept="application/json,.json"
        style="position:absolute;width:1px;height:1px;opacity:0"
        onchange={(e) => void readFile(e.currentTarget.files?.[0])}
      />
    </label>
  </div>

  <textarea
    class="textarea code"
    rows="6"
    aria-label={te('editor.io.paste', language)}
    value={source}
    oninput={(e) => analyse(e.currentTarget.value)}></textarea>

  {#if result}
    <div class="import-report">
      {#if result.ok}
        <p class="report-ok">
          {te('editor.io.reportOk', language, {
            projects: result.portfolio.projects.length,
            categories: result.portfolio.categories.length,
            slides: result.portfolio.freeSlides.length,
          })}
        </p>
      {:else if 'refusal' in result}
        <p class="report-ko">
          {te('editor.io.refused', language)} — {te(`editor.error.${result.refusal}`, language)}
        </p>
      {:else}
        <p class="report-ko">
          {te('editor.io.refused', language)} — {te('editor.io.errorCount', language, {
            n: result.errors.length,
          })}
        </p>
        <ul class="report-warn">
          {#each result.errors as error, i (i)}
            <li>
              — {#if error.path}{error.path} :
              {/if}{errorMessage(error)}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  {#if mergedDone}
    <div class="import-report">
      <p class="report-ok">
        {te('editor.io.mergeDone', language, {
          n: mergedDone.replaced,
          m: mergedDone.added,
        })}
      </p>
    </div>
  {:else if result?.ok}
    <fieldset class="import-mode">
      <legend>{te('editor.io.modeLegend', language)}</legend>
      <label>
        <input type="radio" name="import-mode" value="replace" bind:group={mode} />
        <span>{te('editor.io.mode.replace', language)}</span>
      </label>
      <label>
        <input type="radio" name="import-mode" value="merge" bind:group={mode} />
        <span>{te('editor.io.mode.merge', language)}</span>
      </label>
    </fieldset>

    {#if mode === 'merge'}
      <!-- The names AND the figures come from the DECIDED event, before
           any dispatch: what the preview announces is exactly what the
           merge would record. `before.projects` is the present side —
           the very versions the incoming homonyms would overwrite. -->
      {@const replaced = mergeEvent?.type === 'ProjectsMerged' ? mergeEvent.before.projects : []}
      {#if replaced.length > 0}
        <div class="merge-replaced">
          {te('editor.io.mergeReplacedList', language)}
          <ul>
            {#each replaced as entry (entry.value.id)}
              <li><b>{entry.value.id}</b> · {entry.value.name}</li>
            {/each}
          </ul>
        </div>
      {/if}
      <p class="merge-preview">
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
      <p class="hint">{te('editor.io.mergeHint', language)}</p>
    {:else}
      <label class="keep-settings">
        <input type="checkbox" bind:checked={keepSettings} />
        <span>{te('editor.io.keepSettings', language)}</span>
      </label>
    {/if}
  {/if}

  <div class="modal-actions">
    {#if mergedDone}
      <button class="btn btn-primary" type="button" onclick={close}>
        {te('editor.io.close', language)}
      </button>
    {:else}
      <button class="btn btn-secondary" type="button" onclick={close}>
        {te('editor.io.cancel', language)}
      </button>
      <button
        class="btn btn-primary"
        type="button"
        disabled={!result?.ok || (mode === 'merge' && mergePreview === undefined)}
        onclick={confirmImport}
        >{te(mode === 'merge' ? 'editor.io.merge' : 'editor.io.replace', language)}</button
      >
    {/if}
  </div>
</div>
