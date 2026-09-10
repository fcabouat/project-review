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
   * The dialog is store-agnostic: portfolio in, `dispatch` out. The vendored
   * Dialog owns the overlay, the focus trap and Escape; the vendored Tabs own
   * the tab keyboard interaction.
   *
   * The two tab panels live in `editor/import-export/` (ExportPanel,
   * ImportPanel); this file keeps only the modal chrome and the tab switch.
   */
  import { untrack } from 'svelte'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Dispatch } from '../contracts'
  import { te } from '../i18n'
  import * as Dialog from '../commons/ui/dialog'
  import * as Tabs from '../commons/ui/tabs'
  import ExportPanel from './import-export/ExportPanel.svelte'
  import ImportPanel from './import-export/ImportPanel.svelte'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    readonly tab: 'export' | 'import'
    readonly close: () => void
    /** Sends the user to Settings ▸ Data (samples, purge) — the host closes
     * the dialog and navigates. Absent (a bare story), the pointer line is
     * not shown. */
    readonly openSettings?: () => void
    /** Opening content of the import box, and the mode pre-selected under it
     * (story/testing seams — the user path is drop, browse or paste, then
     * choose). */
    readonly prefill?: string
    readonly prefillMode?: 'replace' | 'merge'
  }

  let { portfolio, dispatch, tab, close, openSettings, prefill, prefillMode }: Props = $props()

  // Opening tab only: the modal owns the choice once it is open.
  let active = $state<'export' | 'import'>(untrack(() => tab))

  const language = $derived(portfolio.settings.language)

  const triggerClass =
    'text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-primary ' +
    'h-auto flex-none grow-0 rounded-none border-x-0 border-t-0 border-b-2 border-transparent ' +
    'bg-transparent px-0.5 py-3.5 text-[13.5px] font-bold shadow-none data-[state=active]:shadow-none'
</script>

<Dialog.Root open onOpenChange={(o) => o || close()}>
  <Dialog.Content
    class="top-11 w-[640px] max-w-[calc(100%-32px)] translate-y-0 gap-0 p-0 sm:max-w-[640px]"
    closeLabel={te('editor.io.close', language)}
  >
    <Dialog.Title class="sr-only">{te('editor.io.title', language)}</Dialog.Title>
    <Tabs.Root value={active} onValueChange={(v) => (active = v as 'export' | 'import')}>
      <Tabs.List
        class="border-border h-auto w-full justify-start gap-[26px] rounded-none border-b bg-transparent p-0 px-5"
      >
        <Tabs.Trigger value="export" class={triggerClass}
          >{te('editor.io.export', language)}</Tabs.Trigger
        >
        <Tabs.Trigger value="import" class={triggerClass}
          >{te('editor.io.import', language)}</Tabs.Trigger
        >
      </Tabs.List>

      <Tabs.Content value="export">
        <ExportPanel {portfolio} {close} />
      </Tabs.Content>
      <Tabs.Content value="import">
        <ImportPanel {portfolio} {dispatch} {close} {prefill} {prefillMode} />
      </Tabs.Content>
    </Tabs.Root>

    {#if openSettings}
      <!-- Discoverability, one quiet line: the sample data and the purge are
           administered from Settings ▸ Data, not from this dialog. -->
      <div class="border-border border-t px-5 py-2.5 text-center">
        <button
          type="button"
          class="text-muted-foreground hover:text-primary cursor-pointer text-[11.5px] underline underline-offset-2"
          onclick={openSettings}
        >
          {te('editor.io.dataPointer', language)}
        </button>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
