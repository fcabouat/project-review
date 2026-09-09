<script lang="ts">
  /**
   * Title slide: white column 489 + blue block
   * 791. No rail, no foot — it is the cover.
   * The four KPIs are derived, never entered; the low signature carries the
   * long directorate / service, with the contact box as a sub-line.
   *
   * Layout lives in the utility classes (screen values, `print:` for the A4
   * transposition — 434 px column, ×0.95 type scale); the stylesheets keep
   * the colors and the flat composition.
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

  const SLIDE_FRAME =
    'slide relative flex h-(--slide-height) w-(--slide-width) overflow-hidden ' +
    'text-[14.5px] leading-[1.45] print:h-[793px] print:w-[1122px] print:text-[13.8px]'
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
  <section class="{SLIDE_FRAME} slide--flat-title">
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
  <section class={SLIDE_FRAME}>
    <div
      class="title-left flex w-(--title-column) flex-none flex-col p-(--slide-margin) print:w-[434px] print:p-10"
    >
      <img
        class="block h-[88px] w-[180px] self-start object-contain object-left print:h-[84px] print:w-[170px]"
        src={shownLogo}
        alt=""
      />
      <div
        class="title-vertical mt-auto rotate-180 self-start text-[44px] leading-none font-extrabold tracking-[-0.01em] uppercase [writing-mode:vertical-rl] print:text-[42px]"
      >
        {t('sidebar.review', language)}
      </div>
    </div>
    <div
      class="title-right relative min-w-0 flex-1 px-(--slide-rail) pt-[187px] pb-0 print:px-[54px] print:pt-[170px]"
    >
      <div class="absolute top-[26px] right-(--slide-margin) print:top-[30px] print:right-10">
        <Cartouche {identity} {review} {language} onColoredBackground />
      </div>
      <h1 class="text-[56px] leading-[1.06] font-extrabold tracking-[-0.015em] print:text-[53px]">
        {review.title}
      </h1>
      <div class="title-sub mt-(--slide-step) text-xl leading-[1.45] print:mt-4 print:text-[19px]">
        {subtitle}
      </div>
      <div
        class="absolute top-[446px] right-(--slide-rail) left-(--slide-rail) flex gap-(--slide-gutter) print:top-[492px] print:right-[54px] print:left-[54px] print:gap-5"
      >
        {@render kpiList(
          'kpi flex-1 pt-(--slide-step) print:pt-4 [&>b]:block [&>b]:text-[40px] [&>b]:font-extrabold [&>b]:leading-none [&>b]:tracking-[-0.02em] print:[&>b]:text-[38px] [&>span]:mt-[9px] [&>span]:block [&>span]:text-[12.5px] [&>span]:leading-[1.3] print:[&>span]:text-[12px]',
        )}
      </div>
      {@render signBlock(
        'title-sign absolute left-(--slide-rail) bottom-(--slide-margin) text-[13px] print:left-[54px] print:bottom-10 print:text-[12.5px]',
        'title-contact mt-1 block text-[11.5px] print:text-[11px]',
      )}
    </div>
  </section>
{/if}
