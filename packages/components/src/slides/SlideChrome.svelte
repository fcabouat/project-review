<script lang="ts">
  /**
   * Common chrome of the inner slides: colored vertical rail with its vertical
   * text, normalized logo box, cartouche at the top right (26 / 44 inset) and
   * the three-part foot (month · legend · "page / total").
   *
   * The title slide and the dividers do NOT use it: they are full-bleed
   * compositions with no rail and no foot.
   */
  import type { Language } from '@project-review/core/model/theme'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { t } from '@project-review/core/services/i18n'
  import Cartouche from '../commons/Cartouche.svelte'
  import { monthLabel } from './labels'
  import defaultLogo from '../assets/logo-dejavu.svg'
  import './theme.css'
  import './print.css'
  import './flat.css'
  import type { Snippet } from 'svelte'

  interface Props {
    readonly portfolio: Portfolio
    /** Text of the vertical rail, already assembled (see `railText`). */
    readonly rail: string
    /** 1-based position in the deck, for the foot. */
    readonly page?: number
    readonly total?: number
    /** Sheet layout: category-colored rail and a smaller logo box. */
    readonly sheet?: boolean
    /** Category color, resolved by the parent (`catColor`). */
    readonly tint?: string
    /** Overrides the settings logo (stories only). */
    readonly logo?: string
    /** Title area, between the header and the body. */
    readonly heading?: Snippet
    readonly children: Snippet
    /** Center of the foot: legend or nothing. */
    readonly footMid?: Snippet
    /** Extra classes on the body box (`--centered`, `--split`, `--tight`). */
    readonly bodyClass?: string
  }

  let {
    portfolio,
    rail,
    page,
    total,
    sheet = false,
    tint,
    logo,
    heading,
    children,
    footMid,
    bodyClass = '',
  }: Props = $props()

  const language = $derived<Language>(portfolio.settings.language)
  const month = $derived(monthLabel(portfolio.review.reviewDate, language))
  const shownLogo = $derived(logo ?? portfolio.settings.identity.logo ?? defaultLogo)
  /** 'flat' restructures the chrome (no rail, sheet header as a color plane). */
  const flat = $derived(portfolio.settings.theme.style === 'flat')
</script>

{#snippet foot()}
  <div class="slide-foot">
    <span>{month}</span>
    <span class="foot-mid"
      >{#if footMid}{@render footMid()}{/if}</span
    >
    <span class="foot-right">
      {#if page !== undefined && total !== undefined}
        {t('footer.pageOf', language, { page, total })}
      {/if}
    </span>
  </div>
{/snippet}

<section class="slide" class:slide--sheet={sheet} style:--cat={tint}>
  {#if flat && sheet}
    <!-- flat sheet: the header is a full-width category color
         plane — kicker, title, chips and meta come from the heading snippet -->
    <div class="flat-head">
      <div class="flat-cart">
        <Cartouche
          identity={portfolio.settings.identity}
          review={portfolio.review}
          {language}
          onColoredBackground
        />
      </div>
      {@render heading?.()}
    </div>
    <div class="canvas">
      {@render children()}
      {@render foot()}
    </div>
  {:else}
    <div class="rail"><span class="rail-text">{rail}</span></div>
    <div class="canvas">
      <div class="head">
        <img class="logo" src={shownLogo} alt="" />
        <Cartouche identity={portfolio.settings.identity} review={portfolio.review} {language} />
      </div>
      {#if flat}
        <!-- the hidden rail's words survive as a kicker line -->
        <div class="flat-kicker">{rail}</div>
      {/if}
      {@render heading?.()}
      {#if sheet}
        {@render children()}
      {:else}
        <div class="slide-body {bodyClass}">{@render children()}</div>
      {/if}
      {@render foot()}
    </div>
  {/if}
</section>
