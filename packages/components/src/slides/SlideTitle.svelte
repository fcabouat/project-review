<script lang="ts">
  /**
   * Title slide: white column 489 + blue block
   * 791. No rail, no foot — it is the cover.
   * The four KPIs are derived, never entered; the low signature carries the
   * long directorate / service, with the contact box as a sub-line.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { kpis } from '@project-review/core/projections'
  import { formatLongDate, t, type CatalogKey } from '@project-review/core/services/i18n'
  import Cartouche from '../commons/Cartouche.svelte'
  import { identityLine } from '../commons/identity-line'
  import defaultLogo from '../assets/logo-dejavu.svg'
  import './theme.css'
  import './print.css'
  import './flat.css'

  interface Props {
    readonly portfolio: Portfolio
    /** Overrides the settings logo (stories only). */
    readonly logo?: string
  }

  let { portfolio, logo }: Props = $props()

  const language = $derived(portfolio.settings.language)
  const review = $derived(portfolio.review)
  const identity = $derived(portfolio.settings.identity)
  const shownLogo = $derived(logo ?? identity.logo ?? defaultLogo)
  const longDate = $derived(formatLongDate(review.reviewDate, language))
  const k = $derived(kpis(portfolio))

  /** The four figures the cover carries — the other two belong to the portfolio dashboard. */
  const indicators = $derived<readonly { value: number; key: CatalogKey }[]>([
    { value: k.tracked, key: 'kpi.tracked' },
    { value: k.active, key: 'kpi.active' },
    { value: k.atRiskOrBlocked, key: 'kpi.atRiskOrBlocked' },
    { value: k.pendingDecisions, key: 'kpi.pendingDecisions' },
  ])

  const subtitle = $derived(review.subtitle ? `${review.subtitle} — ${longDate}` : longDate)
  /** Long forms first, plain forms as fallback; a blank identity leaves no
   * orphan em-dash — and when nothing is filled the signature block hides. */
  const signature = $derived(
    identityLine(' — ', identity.orgLong ?? identity.org, identity.unitLong ?? identity.unit),
  )

  /** 'flat': full indigo field, no white column. */
  const flat = $derived(portfolio.settings.theme.style === 'flat')
  /** The subtitle becomes the spaced-capitals kicker; the date stays below. */
  const flatKicker = $derived(review.subtitle ?? t('sidebar.review', language))
</script>

<!-- The KPI row and the signature block are the SAME content in both arms —
     only the class names change, so each is a local snippet. -->
{#snippet kpiList(itemClass?: string)}
  {#each indicators as indicator (indicator.key)}
    <div class={itemClass}>
      <b>{indicator.value}</b><span>{t(indicator.key, language)}</span>
    </div>
  {/each}
{/snippet}

{#snippet signBlock(signClass: string, contactClass: string)}
  {#if signature || identity.contact}
    <div class={signClass}>
      {signature}
      {#if identity.contact}<span class={contactClass}>{identity.contact}</span>{/if}
    </div>
  {/if}
{/snippet}

{#if flat}
  <section class="slide slide--flat-title">
    <img class="flat-title-logo" src={shownLogo} alt="" />
    <div class="flat-title-cart">
      <Cartouche {identity} {review} {language} onColoredBackground />
    </div>
    <div class="flat-title-field">
      <div class="flat-title-kicker">{flatKicker}</div>
      <h1>{review.title}</h1>
      <div class="flat-title-sub">{longDate}</div>
    </div>
    <div class="flat-title-kpis">
      {@render kpiList()}
    </div>
    {@render signBlock('flat-title-sign', 'flat-title-contact')}
  </section>
{:else}
  <section class="slide">
    <div class="title-left">
      <img class="title-logo" src={shownLogo} alt="" />
      <div class="title-vertical">{t('sidebar.review', language)}</div>
    </div>
    <div class="title-right">
      <div class="title-cartouche">
        <Cartouche {identity} {review} {language} onColoredBackground />
      </div>
      <h1>{review.title}</h1>
      <div class="title-sub">{subtitle}</div>
      <div class="kpis">
        {@render kpiList('kpi')}
      </div>
      {@render signBlock('title-sign', 'title-contact')}
    </div>
  </section>
{/if}
