<script lang="ts">
  /**
   * Category divider (canonical mockup, frames 07 and 09): "monument"
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
    projectsOfCategory,
    showsSheet,
  } from '@project-review/core/projections'
  import { catColor } from '../commons/cat-color'
  import { t } from '@project-review/core/services/i18n'
  import Cartouche from '../commons/Cartouche.svelte'
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

  const tracked = $derived(projectsOfCategory(portfolio, categoryId).filter(isTracked))
  const sheets = $derived(tracked.filter(showsSheet).length)
  const mode = $derived(dividerMode(tracked.length))
  const shown = $derived(mode === 'truncated' ? tracked.slice(0, MAX_ITEMS) : tracked)
  const hidden = $derived(tracked.length - shown.length)

  /** Two-digit numeral: "02" reads as a section number, "2" as a page number. */
  const numeral = $derived(String(number).padStart(2, '0'))

  /** 'flat' (canon F-02): bottom-anchored plate, translucent numeral in flow. */
  const flat = $derived(portfolio.settings.theme.style === 'flat')
</script>

{#if flat}
  <section class="slide slide--divider slide--flat-divider" style:--cat={color}>
    <div class="divider-cartouche">
      <Cartouche
        identity={portfolio.settings.identity}
        review={portfolio.review}
        {language}
        onColoredBackground
      />
    </div>
    <div class="flat-divider-plate">
      <div class="flat-divider-num">{numeral}</div>
      <h2>{category.name}</h2>
      <div class="flat-divider-count">
        {t('divider.count', language, { n: tracked.length, m: sheets })}
      </div>
      <ul class="flat-divider-list" class:flat-divider-list--compact={mode !== 'normal'}>
        {#each shown as project (project.id)}
          <li><b>{project.id}</b>{project.name}</li>
        {/each}
        {#if hidden > 0}
          <li class="flat-divider-more">{t('d2.more', language, { n: hidden })}</li>
        {/if}
      </ul>
    </div>
  </section>
{:else}
  <section class="slide slide--divider" style:--cat={color}>
    <div class="divider-cartouche">
      <Cartouche
        identity={portfolio.settings.identity}
        review={portfolio.review}
        {language}
        onColoredBackground
      />
    </div>
    <div class="divider-numeral">{numeral}</div>
    <div class="divider-block">
      <h2>{category.name}</h2>
      <div class="divider-count">
        {t('divider.count', language, { n: tracked.length, m: sheets })}
      </div>
    </div>
    <ul class="divider-list" class:divider-list--compact={mode !== 'normal'}>
      {#each shown as project (project.id)}
        <li><b>{project.id}</b>{project.name}</li>
      {/each}
      {#if hidden > 0}
        <li class="divider-more">{t('d2.more', language, { n: hidden })}</li>
      {/if}
    </ul>
  </section>
{/if}
