<script lang="ts">
  /** Data-administration card: local-save switch, sample loading, settings reset and content purge. */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { parsePortfolio } from '@project-review/core/services/parse'
  import { emptyPortfolio } from '@project-review/core/data/empty-portfolio'
  import sampleFr from '@project-review/core/samples/sample-portfolio.fr.json'
  import sampleEn from '@project-review/core/samples/sample-portfolio.en.json'
  import { te } from '../../i18n'
  import FieldSwitch from '../../editor/FieldSwitch.svelte'
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

  /* ---- data administration — all UNDOABLE replacements ---- */

  /** Content emptied, review and settings kept: the "organization kit" state. */
  function purge(): void {
    if (!window.confirm(te('editor.data.purgeConfirm', language))) return
    replace({ ...portfolio, categories: [], projects: [], freeSlides: [] })
  }

  /** The bundled sample set of the current language, as a full replacement. */
  function loadExamples(): void {
    if (!window.confirm(te('editor.data.examplesConfirm', language))) return
    const parsed = parsePortfolio(language === 'en' ? sampleEn : sampleFr)
    if (!parsed.ok) return
    replace(parsed.portfolio)
  }

  /** Theme and display back to the defaults; language and identity are kept. */
  function resetSettings(): void {
    if (!window.confirm(te('editor.data.resetSettingsConfirm', language))) return
    const defaults = emptyPortfolio(language, portfolio.review.reviewDate).settings
    replace({
      ...portfolio,
      settings: { ...defaults, language: language, identity: settings.identity },
    })
  }

  function togglePersist(enabled: boolean): void {
    if (!persistence) return
    if (!enabled && !window.confirm(te('editor.data.persistOffConfirm', language))) return
    persistence.toggle(enabled)
  }
</script>

<section class="card">
  <h2>{te('editor.nav.data', language)}</h2>
  {#if persistence}
    <FieldSwitch
      label={te('editor.data.persist', language)}
      checked={persistence.enabled}
      commit={togglePersist}
    />
    <p class="hint">{te('editor.data.persistHint', language)}</p>
  {/if}
  <div class="data-actions">
    <button class="btn btn-secondary btn-sm" type="button" onclick={loadExamples}>
      {te('editor.data.examples', language)}
    </button>
    <button class="btn btn-secondary btn-sm" type="button" onclick={resetSettings}>
      {te('editor.data.resetSettings', language)}
    </button>
    <button class="btn btn-secondary btn-sm btn-danger" type="button" onclick={purge}>
      {te('editor.data.purge', language)}
    </button>
  </div>
  <p class="hint">{te('editor.data.undoHint', language)}</p>
</section>
