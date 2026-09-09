<script lang="ts">
  /**
   * E3 — import / export modal.
   *
   * Export = serialise the portfolio — whole by default, or a PARTIAL file
   * from the category-grouped checkboxes: the selected projects, THEIR
   * categories and the current frame (`partialPortfolio`, core), still a
   * valid stand-alone v3 file a colleague opens alone in the app.
   *
   * Import = the STRICT parse, then ONE command, chosen by mode:
   * `ReplacePortfolio` (historic — the whole file, or content-only with the
   * keep-settings checkbox) or `MergeProjects` (a colleague's contribution:
   * upsert by id, never a deletion). The merge preview and its report both
   * read `mergeReport` on the event `decide` completes — pure calls, nothing
   * dispatched until the user confirms. A file that violates the contract is
   * refused whole, and the report lists EVERY violation (path → localized
   * message) — the user fixes the file, never the parse.
   *
   * The dialog is store-agnostic: portfolio in, `dispatch` out.
   */
  import { untrack } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    parsePortfolio,
    type ParseError,
    type ParseResult,
  } from '@project-review/core/services/parse'
  import {
    partialPortfolio,
    portfolioFileName,
    serializePortfolio,
  } from '@project-review/core/services/portfolio-json'
  import { orphanProjects } from '@project-review/core/projections'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { UNSORTED_CATEGORY } from '@project-review/core/model/category'
  import { decide, type MergeProjects } from '@project-review/core/commands'
  import { mergeReport, type MergeReport } from '@project-review/core/events'
  import type { Dispatch } from '../contracts'
  import { autofocus } from './autofocus'
  import { te } from '../i18n'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    readonly tab: 'export' | 'import'
    readonly close: () => void
    /** Opening content of the import box, and the mode pre-selected under it
     * (story/testing seams — the user path is drop, browse or paste, then
     * choose). */
    readonly prefill?: string
    readonly prefillMode?: 'replace' | 'merge'
  }

  let { portfolio, dispatch, tab, close, prefill, prefillMode }: Props = $props()

  // Opening tab only: the modal owns the choice once it is open.
  let active = $state<'export' | 'import'>(untrack(() => tab))
  /**
   * Contract v2, checked by default: the import replaces the CONTENT (review,
   * categories, projects, free slides) and keeps the local settings — identity,
   * theme, logo, language, display. Unchecked = take the whole file.
   */
  let keepSettings = $state(true)
  /** Import mode — 'replace' is the historic path and the default. */
  let mode = $state<'replace' | 'merge'>(untrack(() => prefillMode ?? 'replace'))
  let source = $state('')
  /** Outcome of the last copy attempt — "Copié" only if the clipboard took it. */
  let copyState = $state<'idle' | 'done' | 'failed'>('idle')
  let dragging = $state(false)
  /** Unreadable JSON is an editor-level refusal, shaped like the parse's own. */
  type ImportOutcome = ParseResult | { readonly ok: false; readonly badJson: true }
  /** `undefined` until something has been submitted — no report on an empty box. */
  let result = $state<ImportOutcome | undefined>(undefined)
  /** Figures of an APPLIED merge — the after-report the panel shows, read off
   * the event `dispatch` returns: what the panel announces is exactly what
   * entered the log. */
  let mergedDone = $state<MergeReport | undefined>(undefined)

  const language = $derived(portfolio.settings.language)
  // Name and payload come from the core (`services/portfolio-json`): the file
  // stays the exact inverse of the strict parse, byte-compatible with the
  // localStorage snapshot.
  const serialised = $derived(serializePortfolio(portfolio))

  /* ---------------- export: selection by category ---------------- */

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
      id: String(category.id),
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
    new Set<string>(portfolio.projects.map((x) => String(x.id)).filter((id) => !excluded.has(id))),
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

  /* ---------------- import: parse, mode, preview ---------------- */

  function analyse(text: string): void {
    source = text
    mergedDone = undefined
    if (text.trim() === '') {
      result = undefined
      return
    }
    try {
      result = parsePortfolio(JSON.parse(text))
    } catch {
      result = { ok: false, badJson: true }
    }
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

<!-- Escape listens on the window (same as SlidePreviewDialog): a handler on the
     dialog node alone goes dead as soon as focus sits anywhere else. -->
<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') close()
  }}
/>

<div
  class="modal-overlay"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) close()
  }}
>
  <!-- Focused on mount: an aria-modal dialog must receive focus when it opens. -->
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-label={te('editor.io.title', language)}
    tabindex="-1"
    use:autofocus
  >
    <div class="modal-tabs">
      <button
        class="tab-label"
        class:active={active === 'export'}
        type="button"
        onclick={() => (active = 'export')}>{te('editor.io.export', language)}</button
      >
      <button
        class="tab-label"
        class:active={active === 'import'}
        type="button"
        onclick={() => (active = 'import')}>{te('editor.io.import', language)}</button
      >
    </div>

    {#if active === 'export'}
      <div class="modal-panel">
        {#if groups.length > 0}
          <fieldset class="export-groups">
            <legend
              >{te('editor.io.selection', language)} — {te('editor.io.selectionCount', language, {
                n: selectedIds.size,
                total: portfolio.projects.length,
              })}</legend
            >
            {#each groups as group (group.id)}
              {@const ids = group.projects.map((x) => String(x.id))}
              {@const checkedCount = ids.filter((id) => !excluded.has(id)).length}
              <div class="export-group">
                <label class="export-group-head">
                  <input
                    type="checkbox"
                    checked={checkedCount === ids.length}
                    indeterminate={checkedCount > 0 && checkedCount < ids.length}
                    onchange={(e) => setChecked(ids, e.currentTarget.checked)}
                  />
                  <span>{group.name}</span>
                </label>
                {#each group.projects as x (x.id)}
                  <label class="export-project">
                    <input
                      type="checkbox"
                      checked={!excluded.has(String(x.id))}
                      onchange={(e) => setChecked([String(x.id)], e.currentTarget.checked)}
                    />
                    <span>{x.id} · {x.name}</span>
                  </label>
                {/each}
              </div>
            {/each}
          </fieldset>
          {#if !allSelected}
            <p class="hint">{te('editor.io.partialHint', language)}</p>
          {/if}
        {/if}
        <textarea
          class="textarea code"
          rows="9"
          readonly
          aria-label={te('editor.io.export', language)}
          value={exportSource}></textarea>
        <div class="modal-actions">
          <button class="btn btn-secondary" type="button" onclick={close}>
            {te('editor.io.close', language)}
          </button>
          <button class="btn btn-secondary" type="button" onclick={copy}>
            {te(
              copyState === 'done'
                ? 'editor.io.copied'
                : copyState === 'failed'
                  ? 'editor.io.copyFailed'
                  : 'editor.io.copy',
              language,
            )}
          </button>
          <button class="btn btn-primary" type="button" onclick={download}>
            {te('editor.io.download', language)}
          </button>
        </div>
      </div>
    {:else}
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
            {:else if 'badJson' in result}
              <p class="report-ko">
                {te('editor.io.refused', language)} — {te('editor.error.badJson', language)}
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
            {@const replaced =
              mergeEvent?.type === 'ProjectsMerged' ? mergeEvent.before.projects : []}
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
    {/if}
  </div>
</div>
