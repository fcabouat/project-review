<script lang="ts">
  /** Data-administration card: local-save switch, settings reset and content
   * purge — every destructive move confirmed in the vendored AlertDialog.
   * The deliverable carries no content: the sample sets live NEXT TO the app
   * and on the project site, and come in through the ordinary import (the
   * guidance line below says so — no fetch, no load button). */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { emptyPortfolio } from '@project-review/core/data/empty-portfolio'
  import { te } from '../../i18n'
  import FieldSwitch from '../../editor/FieldSwitch.svelte'
  import * as AlertDialog from '../../commons/ui/alert-dialog'
  import { Button } from '../../commons/ui/button'
  import type { Dispatch, PersistenceControl } from '../contracts'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    /** Local-save switch; absent → the row is not shown. */
    readonly persistence?: PersistenceControl
  }

  let { portfolio, dispatch, persistence }: Props = $props()

  const settings = $derived(portfolio.settings)
  const language = $derived(settings.language)

  /** Global replacement (purge, samples, reset) — undoable like everything else. */
  function replace(next: Portfolio): void {
    dispatch({ type: 'ReplacePortfolio', portfolio: next })
  }

  /* ---- data administration — all UNDOABLE replacements, one pending
     confirmation at a time (the AlertDialog below carries the wording) ---- */

  type PendingAction = 'purge' | 'resetSettings' | 'persistOff'
  let pending = $state<PendingAction | undefined>(undefined)

  /** Title (the action's own label) and body (the historic confirm wording). */
  const WORDING: Record<PendingAction, { readonly title: string; readonly body: string }> = {
    purge: { title: 'editor.data.purge', body: 'editor.data.purgeConfirm' },
    resetSettings: { title: 'editor.data.resetSettings', body: 'editor.data.resetSettingsConfirm' },
    persistOff: { title: 'editor.data.persist', body: 'editor.data.persistOffConfirm' },
  }

  /** Content emptied, review and settings kept: the "organization kit" state. */
  function purge(): void {
    replace({ ...portfolio, categories: [], projects: [], freeSlides: [] })
  }

  /** Theme and display back to the defaults; language and identity are kept. */
  function resetSettings(): void {
    const defaults = emptyPortfolio(language, portfolio.review.reviewDate).settings
    replace({
      ...portfolio,
      settings: { ...defaults, language: language, identity: settings.identity },
    })
  }

  function confirmPending(): void {
    const action = pending
    pending = undefined
    if (action === 'purge') purge()
    else if (action === 'resetSettings') resetSettings()
    else if (action === 'persistOff') persistence?.toggle(false)
  }

  function togglePersist(enabled: boolean): void {
    if (!persistence) return
    // Turning the local save OFF erases the stored copy: that one confirms.
    if (!enabled) {
      pending = 'persistOff'
      return
    }
    persistence.toggle(enabled)
  }
</script>

<section class="bg-background border-border rounded-lg border p-4">
  <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
    {te('editor.nav.data', language)}
  </h2>
  {#if persistence}
    <!-- No storage in this browser: the switch is disabled and the line below
         says why. A control that moves but changes nothing is worse than no
         control — the person would believe their work is being kept. -->
    <FieldSwitch
      label={te('editor.data.persist', language)}
      checked={persistence.enabled && persistence.available}
      disabled={!persistence.available}
      commit={togglePersist}
    />
    <p class="text-muted-foreground text-[11.5px]">
      {te(
        persistence.available ? 'editor.data.persistHint' : 'editor.data.persistUnavailable',
        language,
      )}
    </p>
  {/if}
  <div class="mt-2.5 flex flex-wrap gap-2">
    <Button variant="outline" size="sm" onclick={() => (pending = 'resetSettings')}>
      {te('editor.data.resetSettings', language)}
    </Button>
    <Button variant="destructive" size="sm" onclick={() => (pending = 'purge')}>
      {te('editor.data.purge', language)}
    </Button>
  </div>
  <p class="text-muted-foreground mt-2.5 text-[11.5px]">{te('editor.data.undoHint', language)}</p>
  <!-- Owner-validated wording: samples accompany the app and the project
       site, and come in through the ordinary import — no load button here. -->
  <p class="text-muted-foreground mt-1 text-[11.5px]">
    {te('editor.data.samplesHint', language)}
  </p>
</section>

<!-- Turning the save back ON found a readable document already stored: the
     host wrote nothing and hands the choice over. Three answers, all
     reversible — restore (undoable), keep the open document, or step back. -->
{#if persistence?.pendingRestore}
  <AlertDialog.Root open onOpenChange={(o) => o || persistence?.dismissRestore()}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>{te('editor.data.restoreTitle', language)}</AlertDialog.Title>
        <AlertDialog.Description>{te('editor.data.restoreBody', language)}</AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel>{te('editor.io.cancel', language)}</AlertDialog.Cancel>
        <Button variant="outline" onclick={() => persistence?.keepOpen()}>
          {te('editor.data.restoreKeepOpen', language)}
        </Button>
        <AlertDialog.Action onclick={() => persistence?.restore()}>
          {te('editor.data.restoreStored', language)}
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}

<!-- One dialog for the four confirmations: the pending action names its own
     title and body; Confirm dispatches, anything else drops the intent. -->
{#if pending}
  {@const wording = WORDING[pending]}
  <AlertDialog.Root open onOpenChange={(o) => o || (pending = undefined)}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>{te(wording.title, language)}</AlertDialog.Title>
        <AlertDialog.Description>{te(wording.body, language)}</AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel>{te('editor.io.cancel', language)}</AlertDialog.Cancel>
        <AlertDialog.Action onclick={confirmPending}
          >{te('editor.confirm', language)}</AlertDialog.Action
        >
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
