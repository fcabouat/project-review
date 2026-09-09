<script lang="ts">
  /**
   * Portfolio dashboard "The portfolio": the six derived
   * indicators, then one bar per non-empty category.
   * The bar scale is shared: 4 projects = 489 px, otherwise comparing two
   * categories would mean nothing. The legend sits in the foot.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import {
    categoryBars,
    categoryOf,
    kpis,
    projectsOfGroup,
    isTracked,
  } from '@project-review/core/projections'
  import { catColor } from '../commons/cat-color'
  import { t, type CatalogKey } from '@project-review/core/services/i18n'
  import StatChip, { type StatTone } from '../commons/StatChip.svelte'
  import CategoryBarView from '../commons/CategoryBar.svelte'
  import SlideChrome from './SlideChrome.svelte'
  import { categoryName, railText } from './labels'

  interface Props {
    readonly portfolio: Portfolio
    readonly page?: number
    readonly total?: number
    readonly logo?: string
  }

  let { portfolio, page, total, logo }: Props = $props()

  const language = $derived(portfolio.settings.language)
  const k = $derived(kpis(portfolio))

  const indicators = $derived<readonly { value: number; key: CatalogKey; tone: StatTone }[]>([
    { value: k.tracked, key: 'kpi.tracked', tone: 'neutral' },
    { value: k.active, key: 'kpi.active', tone: 'accent' },
    { value: k.atRiskOrBlocked, key: 'kpi.atRiskOrBlocked', tone: 'alert' },
    { value: k.overdueMilestones, key: 'kpi.overdueMilestones', tone: 'critical' },
    { value: k.pendingDecisions, key: 'kpi.pendingDecisions', tone: 'neutral' },
    { value: k.doneWithResiduals, key: 'kpi.doneResiduals', tone: 'good' },
  ])

  const rows = $derived(
    categoryBars(portfolio).map((bar) => {
      const category = categoryOf(portfolio, bar.categoryId)
      return {
        bar,
        // categoryName, not .name: the unsorted sentinel carries a catalog KEY.
        name: categoryName(category, language),
        color: catColor(category.color),
        // `projectsOfGroup`: the unsorted bar counts the real orphans.
        count: projectsOfGroup(portfolio, bar.categoryId).filter(isTracked).length,
      }
    }),
  )

  const legend = $derived<readonly { kind: string; key: CatalogKey }[]>([
    { kind: 'inProgress', key: 'd1.legend.inProgress' },
    { kind: 'preProject', key: 'd1.legend.preProject' },
    { kind: 'done', key: 'd1.legend.done' },
  ])
</script>

<SlideChrome
  {portfolio}
  rail={railText(language, t('sidebar.overview', language))}
  {page}
  {total}
  {logo}
>
  {#snippet heading()}
    <h2
      class="slide-heading mt-(--slide-step) flex-none text-[30px] leading-9 font-bold tracking-[-0.01em] print:mt-4 print:text-[28.5px] print:leading-[34px]"
    >
      {t('d1.title', language)}
    </h2>
  {/snippet}

  <div class="flex h-[88px] flex-none gap-3.5 print:h-[92px] print:gap-3">
    {#each indicators as indicator (indicator.key)}
      <StatChip value={indicator.value} label={t(indicator.key, language)} tone={indicator.tone} />
    {/each}
  </div>
  <!-- the only measure that belongs to this slide alone: the air between the
       indicator row and the breakdown (34 px) -->
  <div class="label label--accent mt-[34px]">{t('d1.breakdown', language)}</div>
  <div class="mt-(--slide-step) flex min-h-0 flex-1 flex-col justify-between">
    {#each rows as row (row.bar.categoryId)}
      <div
        class="category-row flex h-[27px] items-center gap-3 print:h-[30px]"
        style:--cat={row.color}
      >
        <span
          class="category-name w-[170px] flex-none text-[13px] font-semibold print:text-[12.5px]"
          >{row.name}</span
        >
        <span
          class="category-count w-6 flex-none text-right text-[13px] font-bold print:text-[12.5px]"
          >{row.count}</span
        >
        <CategoryBarView bar={row.bar} />
      </div>
    {/each}
  </div>

  {#snippet footMid()}
    <span class="flex items-center justify-center">
      {#each legend as item (item.kind)}
        <i
          class="legend-key legend-key--{item.kind} mr-[5px] ml-3.5 inline-block h-[9px] w-[13px] rounded-[2px] first:ml-0"
        ></i>{t(item.key, language)}
      {/each}
    </span>
  {/snippet}
</SlideChrome>
