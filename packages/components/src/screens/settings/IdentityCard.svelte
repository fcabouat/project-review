<script lang="ts">
  /** Identity card: organization, unit and contact fields plus the inline logo import. */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { LOGO_MAX_CHARS } from '@project-review/core/services/parse'
  import type { IdentityField } from '@project-review/core/events'
  import { te } from '../../i18n'
  import FieldText from '../../editor/FieldText.svelte'
  import type { Dispatch } from '../contracts'
  import defaultLogo from '../../assets/logo-dejavu.svg'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
  }

  let { portfolio, dispatch }: Props = $props()

  const settings = $derived(portfolio.settings)
  const identity = $derived(settings.identity)
  const language = $derived(settings.language)

  /** One identity field ↔ one `ChangeIdentityField`, at blur. */
  function setIdentity(field: Exclude<IdentityField, 'logo'>, next: string | undefined): void {
    dispatch({ type: 'ChangeIdentityField', field, after: next } as never)
  }

  /* ---- inline logo (data URI in the JSON, bundled Déjà Vu fallback) ---- */

  let logoInput = $state<HTMLInputElement | undefined>()
  let logoError = $state<string | undefined>(undefined)

  function importLogo(files: FileList | null): void {
    logoError = undefined
    const file = files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onerror = () => (logoError = te('editor.settings.logoUnreadable', language))
    reader.onload = () => {
      const uri = typeof reader.result === 'string' ? reader.result : undefined
      if (!uri || !uri.startsWith('data:image/')) {
        logoError = te('editor.settings.logoUnreadable', language)
        return
      }
      if (uri.length > LOGO_MAX_CHARS) {
        logoError = te('editor.settings.logoTooBig', language)
        return
      }
      dispatch({ type: 'ChangeIdentityField', field: 'logo', after: uri })
    }
    reader.readAsDataURL(file)
  }

  function resetLogo(): void {
    logoError = undefined
    dispatch({ type: 'ChangeIdentityField', field: 'logo', after: undefined })
  }
</script>

<section class="card">
  <h2>{te('editor.review.identity', language)}</h2>
  <FieldText
    {language}
    label={te('editor.field.org', language)}
    value={identity.org}
    commit={(v) => setIdentity('org', v)}
  />
  <FieldText
    {language}
    label={te('editor.field.unit', language)}
    value={identity.unit}
    commit={(v) => setIdentity('unit', v)}
  />
  <FieldText
    {language}
    label={te('editor.field.orgLong', language)}
    value={identity.orgLong}
    commit={(v) => setIdentity('orgLong', v)}
  />
  <FieldText
    {language}
    label={te('editor.field.unitLong', language)}
    value={identity.unitLong}
    commit={(v) => setIdentity('unitLong', v)}
  />
  <FieldText
    {language}
    label={te('editor.field.contact', language)}
    value={identity.contact}
    commit={(v) => setIdentity('contact', v)}
  />

  <div class="field-group" style="margin-bottom:0">
    <span class="label">{te('editor.settings.logo', language)}</span>
    <div class="logo-row">
      <img class="logo-preview" src={identity.logo ?? defaultLogo} alt="" />
      <div class="logo-actions">
        <button class="btn btn-secondary btn-sm" type="button" onclick={() => logoInput?.click()}>
          {te('editor.settings.logoImport', language)}
        </button>
        {#if identity.logo !== undefined}
          <button class="btn btn-secondary btn-sm" type="button" onclick={resetLogo}>
            {te('editor.settings.logoReset', language)}
          </button>
        {/if}
      </div>
    </div>
    <input
      bind:this={logoInput}
      type="file"
      accept="image/svg+xml,image/png,image/jpeg,image/webp"
      style="display:none"
      onchange={(e) => importLogo(e.currentTarget.files)}
    />
    {#if logoError}
      <p class="hint" role="alert" style="color:var(--err)">{logoError}</p>
    {:else}
      <p class="hint">{te('editor.settings.logoHint', language)}</p>
    {/if}
  </div>
</section>
