<script lang="ts">
  /**
   * Global save warnings. Normal feedback belongs inside edited fields;
   * errors, disabled storage and conflicts remain visible under the top bar.
   *
   * It exists because the opposite is the worst failure this application can
   * have: a quota-full, private-browsing or restricted storage silently
   * refuses the write, the editor keeps behaving as if all were well, and the
   * work disappears at the next reload. States that need a human therefore
   * keep a visible strip saying what can be done about them, right there:
   *  - `error` — the storage refused. The document lives in this tab and
   *    nowhere else, so the one offer that actually saves it is made on the
   *    spot: « download a copy ». The in-memory document is never lost for
   *    want of a write;
   *  - `unavailable` — this browser has no storage to refuse WITH. Same
   *    consequence, said from the first second rather than at the first
   *    deadline, and the same offer;
   *  - `off` — someone switched the local save off in this browser, this tab
   *    or another. Same consequence again, same offer, plus where to turn it
   *    back on: a privacy choice is reversed by a person, never by a save;
   *  - `conflict` — another tab wrote over the copy this one was working
   *    from. NOTHING was overwritten, and the two answers are the only honest
   *    ones: take theirs (undoable) or keep this one. No silent merge.
   *
   * And one phase that needs nobody but says what « saved » would hide:
   * `pending` awaits a raw checkpoint; `draftSaved` confirms that checkpoint
   * without claiming that the input is a validated document edit. Leaving a
   * field still records one event. Draft downloads rescue unvalidated text
   * when local writes fail; normal portfolio exports contain only the model.
   *
   * Pure view: the host supplies the state and the two decisions; the download
   * is a Blob the browser saves, like the export panel's.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import {
    portfolioFileName,
    serializePortfolio,
  } from '@project-review/core/services/portfolio-json'
  import { te } from '../i18n'
  import { Button } from '../commons/ui/button'
  import type { SaveState } from '../contracts'
  import type { DraftSnapshot } from '@project-review/core/services/persistence'

  interface Props {
    /** The document itself — what « download a copy » hands over. */
    readonly portfolio: Portfolio
    readonly save: SaveState
    readonly drafts?: readonly DraftSnapshot[]
    /** Conflict, first answer: load what the other tab saved (undoable). */
    readonly takeStored: () => void
    /** Conflict, second answer: this document replaces the stored one. */
    readonly keepMine: () => void
  }

  let { portfolio, save, drafts = [], takeStored, keepMine }: Props = $props()

  const language = $derived(portfolio.settings.language)
  /** The phase leaves the document in this tab alone — same consequence, same
   * offer, whether the write failed, was never possible, or was switched off
   * by whoever set the preference this browser now holds. */
  const unsaved = $derived(
    save.phase === 'error' || save.phase === 'unavailable' || save.phase === 'off',
  )
  /** The three phases a person must not scroll past: they carry actions, and
   * they are the only ones announced to assistive tech. */
  const alarming = $derived(unsaved || save.phase === 'conflict')

  /** Ground and ink per phase — the alarming ones use the AA-checked token
   * pairs (`--err`/`--err-bg`, `--warn`/`--warn-bg`). */
  const tone = $derived(
    unsaved
      ? 'bg-(--err-bg) text-(--err) border-(--err)/30'
      : save.phase === 'conflict'
        ? 'bg-(--warn-bg) text-(--warn) border-(--warn)/30'
        : 'bg-background text-muted-foreground border-border',
  )

  /** One shape for the message, whichever of the two nodes carries it. */
  const message = 'text-[12px] leading-[1.5] font-semibold'

  function downloadCopy(): void {
    download(serializePortfolio(portfolio), portfolioFileName(portfolio.review.reviewDate))
  }

  function download(text: string, name: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }
</script>

<!-- A NAMED REGION when visible: the strip sits between the banner and the main
     content, and content outside every landmark is content a screen-reader
     rotor cannot reach. The alerting node below is a SEPARATE element that
     appears when the phase turns — an inserted alert is announced, where a
     role swapped onto a node that was already there may not be.
     `data-save-phase` is the deliberate seam the two-tab smoke run reads: the
     phase is otherwise only legible through localized prose, which no test
     should have to match on. -->
{#if alarming}
  <section
    class="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-[22px] py-1.5 max-lg:px-3 {tone}"
    aria-label={te('editor.save.aria', language)}
    data-save-phase={save.phase}
  >
    <p role="alert" class={message}>{te(`editor.save.${save.phase}`, language)}</p>
    {#if unsaved}
      <Button variant="outline" size="sm" class="max-lg:min-h-11" onclick={downloadCopy}>
        {te('editor.save.download', language)}
      </Button>
    {:else if save.phase === 'conflict'}
      <Button variant="outline" size="sm" class="max-lg:min-h-11" onclick={takeStored}>
        {te('editor.save.takeStored', language)}
      </Button>
      <Button variant="outline" size="sm" class="max-lg:min-h-11" onclick={keepMine}>
        {te('editor.save.keepMine', language)}
      </Button>
    {/if}
    {#if (unsaved || save.phase === 'conflict') && drafts.length > 0}
      <Button
        variant="outline"
        size="sm"
        class="max-lg:min-h-11"
        onclick={() =>
          download(JSON.stringify({ format: 1, drafts }, null, 2), 'project-review-drafts.json')}
      >
        {te('editor.save.downloadDrafts', language)}
      </Button>
    {/if}
  </section>
{:else}
  <!-- Keep the phase seam available to diagnostics without presenting a
       persistent normal-state banner to people or assistive technology. -->
  <div data-save-phase={save.phase} class="hidden" aria-hidden="true"></div>
{/if}
