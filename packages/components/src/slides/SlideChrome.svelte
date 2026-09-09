<script lang="ts">
  /**
   * Common chrome of the inner slides: colored vertical rail with its vertical
   * text, normalized logo box, cartouche at the top right (26 / 44 inset) and
   * the three-part foot (month · legend · "page / total").
   *
   * The title slide and the dividers do NOT use it: they are full-bleed
   * compositions with no rail and no foot.
   *
   * Layout lives in the utility classes (screen values, `print:` for the A4
   * transposition); the stylesheets keep the THEMED side — colors, fonts,
   * the flat restructuring and the atom-interior reaches.
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
  <div
    class="slide-foot flex h-3.5 flex-none items-center justify-between gap-(--slide-step) text-[11px] print:h-[13px] print:gap-4 print:text-[10.5px] {sheet
      ? 'mt-[13px] print:mt-3.5'
      : 'mt-(--slide-step) print:mt-4'}"
  >
    <span>{month}</span>
    <span class="flex-1 text-center"
      >{#if footMid}{@render footMid()}{/if}</span
    >
    <span class="whitespace-nowrap">
      {#if page !== undefined && total !== undefined}
        {t('footer.pageOf', language, { page, total })}
      {/if}
    </span>
  </div>
{/snippet}

<section
  class="slide relative flex h-(--slide-height) w-(--slide-width) overflow-hidden text-[14.5px] leading-[1.45] print:h-[793px] print:w-[1122px] print:text-[13.8px]"
  class:slide--sheet={sheet}
  style:--cat={tint}
>
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
    <div
      class="canvas flex min-w-0 flex-1 flex-col px-(--slide-margin) pt-[26px] pb-[22px] print:px-10 print:pt-[30px] print:pb-[26px]"
    >
      {@render children()}
      {@render foot()}
    </div>
  {:else}
    <div
      class="rail flex w-(--slide-rail) flex-none items-end justify-center pb-(--slide-margin) print:pb-10"
    >
      <span
        class="rail-text rotate-180 text-[13.5px] font-bold tracking-[0.14em] whitespace-nowrap uppercase [writing-mode:vertical-rl] print:text-[13px] print:tracking-[0.13em]"
        >{rail}</span
      >
    </div>
    <div
      class="canvas flex min-w-0 flex-1 flex-col px-(--slide-margin) pt-[26px] pb-[22px] print:px-10 print:pt-[30px] print:pb-[26px]"
    >
      <div
        class="head flex flex-none items-start justify-between {sheet
          ? 'h-auto'
          : 'h-16 print:h-[60px]'}"
      >
        <img
          class="logo block object-contain object-left {sheet
            ? 'h-12 w-[135px] print:h-[45px] print:w-[127px]'
            : 'h-16 w-[180px] print:h-[60px] print:w-[170px]'}"
          src={shownLogo}
          alt=""
        />
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
        <!-- print keeps its 16 px via print.css: the unlayered `--tight`
             modifier must stay beatable by the A4 rule, as it always was -->
        <div class="slide-body mt-(--slide-step) flex min-h-0 flex-1 flex-col {bodyClass}">
          {@render children()}
        </div>
      {/if}
      {@render foot()}
    </div>
  {/if}
</section>
