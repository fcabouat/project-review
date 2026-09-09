<script lang="ts">
  /**
   * Import / export modal.
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
   *
   * The two tab panels live in `editor/import-export/` (ExportPanel,
   * ImportPanel); this file keeps only the modal chrome and the tab switch.
   */
  import { untrack } from 'svelte'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Dispatch } from '../contracts'
  import { autofocus } from './autofocus'
  import { te } from '../i18n'
  import ExportPanel from './import-export/ExportPanel.svelte'
  import ImportPanel from './import-export/ImportPanel.svelte'

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

  const language = $derived(portfolio.settings.language)
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
      <ExportPanel {portfolio} {close} />
    {:else}
      <ImportPanel {portfolio} {dispatch} {close} {prefill} {prefillMode} />
    {/if}
  </div>
</div>
