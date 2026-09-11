<script lang="ts">
  /**
   * Recovery screen — what the application shows INSTEAD of the editor when a
   * document is stored and could not be read back.
   *
   * The rule it serves: data the app failed to read is never overwritten. The
   * automatic saves are already disarmed by the time this screen renders (the
   * host's persistence control); the screen exists so the choice belongs to a
   * person and is made once, in the open:
   *  - « Download the backup » hands back the stored bytes VERBATIM — nothing
   *    is repaired, reformatted or truncated on the way out, so whoever fixes
   *    the file works on the original;
   *  - « Start empty » is the only path that abandons it, and it takes a
   *    deliberate click.
   * Between the two, the exhaustive report says what the contract found — the
   * same wording the import dialog uses, because it is the same verdict.
   *
   * Pure screen: the host injects the decision (`startEmpty`); the download is
   * a Blob the browser saves, like the export panel's.
   */
  import type { Language } from '@project-review/core/model/theme'
  import type { ParseError } from '@project-review/core/services/parse'
  import type { StateRefusal } from '@project-review/core/services/persistence'
  import { UNREADABLE_STATE_FILE_NAME } from '@project-review/core/services/portfolio-json'
  import { te } from '../i18n'
  import { Button } from '../commons/ui/button'

  interface Props {
    readonly language: Language
    /** Why the stored envelope was refused — the parse's exhaustive error
     * list, or one of the pre-parse refusals. */
    readonly refusal: StateRefusal
    /** The stored bytes, exactly as they sit in the storage. */
    readonly raw: string
    /** The host's explicit-decision hook: abandon the stored bytes and start over. */
    readonly startEmpty: () => void
  }

  let { language, refusal, raw, startEmpty }: Props = $props()

  /** Localized wording of one contract violation — the import dialog's. */
  const errorMessage = (error: ParseError): string =>
    te(`editor.error.${error.code}`, language, error.params)

  const sizeKb = $derived(Math.max(1, Math.round(raw.length / 1024)))

  function download(): void {
    // `text/plain`: the payload is whatever was stored — calling it JSON when
    // the parse just refused it would be a claim, not a fact.
    const url = URL.createObjectURL(new Blob([raw], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = UNREADABLE_STATE_FILE_NAME
    link.click()
    URL.revokeObjectURL(url)
  }
</script>

<main id="main" class="bg-secondary flex min-h-screen items-start justify-center p-5 max-md:p-3">
  <div
    class="bg-background border-border mt-10 w-full max-w-[680px] rounded-lg border p-6 max-md:p-4"
  >
    <h1 class="text-foreground mb-2 text-lg font-extrabold tracking-[-0.01em]">
      {te('editor.recovery.title', language)}
    </h1>
    <p class="text-(--txt2) mb-1 text-[13.5px] leading-[1.55]">
      {te('editor.recovery.lead', language)}
    </p>
    <p class="text-muted-foreground mb-4 text-[12.5px] leading-[1.55]">
      {te('editor.recovery.safe', language, { n: sizeKb })}
    </p>

    <div class="bg-secondary mb-4 rounded-md px-3.5 py-3">
      {#if 'refusal' in refusal}
        <p class="text-destructive text-[13px] font-bold">
          {te(`editor.error.${refusal.refusal}`, language)}
        </p>
      {:else}
        <p class="text-destructive mb-2 text-[13px] font-bold">
          {te('editor.io.errorCount', language, { n: refusal.errors.length })}
        </p>
        <ul class="m-0 flex max-h-[190px] list-none flex-col gap-1.5 overflow-auto p-0">
          {#each refusal.errors as error, i (i)}
            <li class="text-(--warn) text-[12.5px]">
              — {#if error.path}{error.path} :
              {/if}{errorMessage(error)}
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="flex flex-wrap gap-2.5">
      <Button class="max-lg:min-h-11" onclick={download}>
        {te('editor.recovery.download', language)}
      </Button>
      <Button variant="outline" class="max-lg:min-h-11" onclick={startEmpty}>
        {te('editor.recovery.startEmpty', language)}
      </Button>
    </div>
    <p class="text-muted-foreground mt-3 text-[11.5px] leading-[1.55]">
      {te('editor.recovery.startEmptyHint', language)}
    </p>
  </div>
</main>
