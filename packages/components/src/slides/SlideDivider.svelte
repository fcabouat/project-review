<script lang="ts">
  /**
   * Category divider: "monument"
   * composition — giant numeral anchored bottom-left and bleeding off both
   * edges, right-aligned content column under the cartouche.
   * Three modes, decided by `dividerMode` on the project count: a plain list up
   * to 5, two columns from 6 to 10, truncated with "+n more" beyond.
   *
   * Layout lives in the utility classes (screen values, `print:` for the A4
   * transposition); the stylesheets keep the ink-on-category colors and the
   * flat composition.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import {
    categoryOf,
    dividerMode,
    isTracked,
    projectsOfGroup,
    showsSheet,
  } from '@project-review/core/projections'
  import { catColor } from '../commons/cat-color'
  import { t } from '@project-review/core/services/i18n'
  import Cartouche from '../commons/Cartouche.svelte'
  import { categoryName } from './labels'
  import './theme.css'
  import './print.css'
  import './flat.css'

  interface Props {
    readonly portfolio: Portfolio
    readonly categoryId: string
    /** Rank of the divider in the deck, shown as the monumental numeral. */
    readonly number: number
  }

  let { portfolio, categoryId, number }: Props = $props()

  /** Beyond 10 the column would run past the floor: the list gets truncated. */
  const MAX_ITEMS = 10

  const language = $derived(portfolio.settings.language)
  const category = $derived(categoryOf(portfolio, categoryId))
  const color = $derived(catColor(category.color))

  // `projectsOfGroup`, not `projectsOfCategory`: the unsorted divider lists
  // the real orphans (any ghost `categoryId`), like the deck that emitted it.
  const tracked = $derived(projectsOfGroup(portfolio, categoryId).filter(isTracked))
  const sheets = $derived(tracked.filter(showsSheet).length)
  const mode = $derived(dividerMode(tracked.length))
  const shown = $derived(mode === 'truncated' ? tracked.slice(0, MAX_ITEMS) : tracked)
  const hidden = $derived(tracked.length - shown.length)

  /** Two-digit numeral: "02" reads as a section number, "2" as a page number. */
  const numeral = $derived(String(number).padStart(2, '0'))

  /** 'flat': bottom-anchored plate, translucent numeral in flow. */
  const flat = $derived(portfolio.settings.theme.style === 'flat')

  const SLIDE_FRAME =
    'slide slide--divider relative h-(--slide-height) w-(--slide-width) overflow-hidden ' +
    'text-[14.5px] leading-[1.45] print:h-[793px] print:w-[1122px] print:text-[13.8px]'
</script>

<!-- The two arms compose the SAME pieces (cartouche, heading + count, list) —
     only the wrapper classes change, so each piece is a local snippet. -->
{#snippet cartouche()}
  <div
    class="divider-cartouche absolute top-[26px] right-(--slide-margin) z-3 print:top-[30px] print:right-10"
  >
    <Cartouche
      identity={portfolio.settings.identity}
      review={portfolio.review}
      {language}
      onColoredBackground
    />
  </div>
{/snippet}

{#snippet headingAndCount(headingClass: string, countClass: string)}
  <!-- categoryName, not .name: the unsorted sentinel carries a catalog KEY. -->
  <h2 class={headingClass}>{categoryName(category, language)}</h2>
  <div class={countClass}>
    {t('divider.count', language, { n: tracked.length, m: sheets })}
  </div>
{/snippet}

{#snippet projectList(
  listClass: string,
  itemClass: string,
  itemBoldClass: string,
  moreClass: string,
)}
  <ul class={listClass}>
    {#each shown as project (project.id)}
      <li class={itemClass}><b class={itemBoldClass}>{project.id}</b>{project.name}</li>
    {/each}
    {#if hidden > 0}
      <li class={moreClass}>{t('d2.more', language, { n: hidden })}</li>
    {/if}
  </ul>
{/snippet}

{#if flat}
  <section class="{SLIDE_FRAME} slide--flat-divider" style:--cat={color}>
    {@render cartouche()}
    <div class="flat-divider-plate">
      <div class="flat-divider-num">{numeral}</div>
      {@render headingAndCount('', 'flat-divider-count')}
      {@render projectList(
        mode !== 'normal' ? 'flat-divider-list flat-divider-list--compact' : 'flat-divider-list',
        '',
        '',
        'flat-divider-more',
      )}
    </div>
  </section>
{:else}
  <section class="{SLIDE_FRAME} block" style:--cat={color}>
    {@render cartouche()}
    <div
      class="divider-numeral absolute -bottom-[92px] -left-7 z-1 text-[400px] leading-none font-extrabold tracking-[-0.02em] print:-bottom-[84px] print:-left-[26px] print:text-[360px]"
    >
      {numeral}
    </div>
    <div
      class="absolute top-[376px] right-(--slide-margin) z-2 max-w-[920px] text-right print:top-[424px] print:right-10 print:max-w-[880px]"
    >
      {@render headingAndCount(
        'text-[64px] leading-[1.05] font-extrabold tracking-[-0.015em] print:text-[58px]',
        'divider-count mt-3.5 text-[15px] print:mt-[13px]',
      )}
    </div>
    {@render projectList(
      mode !== 'normal'
        ? 'divider-list absolute top-[520px] right-(--slide-margin) z-2 m-0 grid w-[1000px] grid-cols-2 gap-x-[34px] p-0 print:top-[566px] print:right-10 print:w-[960px]'
        : 'divider-list absolute top-[520px] right-(--slide-margin) z-2 m-0 w-[680px] p-0 print:top-[566px] print:right-10 print:w-[640px]',
      'list-none py-[9px] text-right text-sm leading-[1.35] print:text-[13.5px]',
      'mr-1.5 font-bold',
      'divider-more col-span-full list-none py-[9px] text-right text-[13px] italic',
    )}
  </section>
{/if}
