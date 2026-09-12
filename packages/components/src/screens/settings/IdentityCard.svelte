<script lang="ts">
  /**
   * Identity card: who publishes the review — organization, unit and contact.
   * The MARK is not here: the logo is a file the portfolio CARRIES, so it
   * lives with the other two carried assets (the palette and the embedded
   * font faces) in the Appearance card's «portfolio identity» section.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { IdentityField } from '@project-review/core/events'
  import { te } from '../../i18n'
  import FieldText from '../../editor/FieldText.svelte'
  import type { Dispatch } from '../contracts'

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
</script>

<section class="bg-background border-border rounded-lg border p-4">
  <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
    {te('editor.review.identity', language)}
  </h2>
  <!-- `required`: org and unit are `string` in the model (a blank start ships
       them empty), so clearing one stores `''` — the state the contract has
       for "not filled" — instead of an absence the gate refuses in silence. -->
  <FieldText
    {language}
    label={te('editor.field.org', language)}
    value={identity.org}
    commit={(v) => setIdentity('org', v)}
    required
  />
  <FieldText
    {language}
    label={te('editor.field.unit', language)}
    value={identity.unit}
    commit={(v) => setIdentity('unit', v)}
    required
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
</section>
