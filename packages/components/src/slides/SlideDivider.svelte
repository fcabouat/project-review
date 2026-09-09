<script lang="ts">
  /**
   * Category divider: "monument"
   * composition — giant numeral anchored bottom-left and bleeding off both
   * edges, right-aligned content column under the cartouche.
   * Three modes, decided by `dividerMode` on the project count: a plain list up
   * to 5, two columns from 6 to 10, truncated with "+n more" beyond.
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
</script>

<!-- The two arms compose the SAME pieces (cartouche, heading + count, list) —
     only the wrapper classes change, so each piece is a local snippet. -->
{#snippet cartouche()}
  <div class="divider-cartouche">
    <Cartouche
      identity={portfolio.settings.identity}
      review={portfolio.review}
      {language}
      onColoredBackground
    />
  </div>
{/snippet}

{#snippet headingAndCount(countClass: string)}
  <!-- categoryName, not .name: the unsorted sentinel carries a catalog KEY. -->
  <h2>{categoryName(category, language)}</h2>
  <div class={countClass}>
    {t('divider.count', language, { n: tracked.length, m: sheets })}
  </div>
{/snippet}

{#snippet projectList(base: string, moreClass: string)}
  <ul class={mode !== 'normal' ? `${base} ${base}--compact` : base}>
    {#each shown as project (project.id)}
      <li><b>{project.id}</b>{project.name}</li>
    {/each}
    {#if hidden > 0}
      <li class={moreClass}>{t('d2.more', language, { n: hidden })}</li>
    {/if}
  </ul>
{/snippet}

{#if flat}
  <section class="slide slide--divider slide--flat-divider" style:--cat={color}>
    {@render cartouche()}
    <div class="flat-divider-plate">
      <div class="flat-divider-num">{numeral}</div>
      {@render headingAndCount('flat-divider-count')}
      {@render projectList('flat-divider-list', 'flat-divider-more')}
    </div>
  </section>
{:else}
  <section class="slide slide--divider" style:--cat={color}>
    {@render cartouche()}
    <div class="divider-numeral">{numeral}</div>
    <div class="divider-block">
      {@render headingAndCount('divider-count')}
    </div>
    {@render projectList('divider-list', 'divider-more')}
  </section>
{/if}
