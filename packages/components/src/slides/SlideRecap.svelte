<script lang="ts">
  /**
   * Recap "Where do projects stand?":
   * one row per tracked project, paginated by `recapRows`.
   * The last page stops on its rows — the table never stretches to fill the
   * frame. The next milestone turns red when it is overdue.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import {
    categoryOf,
    milestoneState,
    nextMilestone,
    pendingDecisionsOf,
    projectById,
    projectGauge,
    recapPages,
  } from '@project-review/core/projections'
  import { catColor } from '../commons/cat-color'
  import { formatShortDate, t } from '@project-review/core/services/i18n'
  import StageChip from '../commons/StageChip.svelte'
  import HealthDot from '../commons/HealthDot.svelte'
  import ProgressGauge from '../commons/ProgressGauge.svelte'
  import SlideChrome from './SlideChrome.svelte'
  import { displayLabel } from '../commons/display'
  import { categoryName, columns, railText } from './labels'

  interface Props {
    readonly portfolio: Portfolio
    readonly projectIds: readonly string[]
    readonly pageNumber: number
    readonly totalPages: number
    readonly page?: number
    readonly total?: number
    readonly logo?: string
  }

  let { portfolio, projectIds, pageNumber, totalPages, page, total, logo }: Props = $props()

  const language = $derived(portfolio.settings.language)
  const headers = $derived(columns('recap.columns', language))

  /* Foot of every page but the last: how many tracked projects follow. */
  const nextPageCount = $derived(
    pageNumber < totalPages ? (recapPages(portfolio)[pageNumber]?.length ?? 0) : 0,
  )

  const rows = $derived(
    projectIds.flatMap((id) => {
      const project = projectById(portfolio, id)
      if (!project) return []
      const category = categoryOf(portfolio, project.categoryId)
      const milestone = nextMilestone(project)
      return [
        {
          project,
          category,
          color: catColor(category.color),
          milestone,
          late:
            milestone !== undefined &&
            milestoneState(milestone, portfolio.review.reviewDate) === 'overdue',
          // A pending decision is a decision with no outcome.
          pending: pendingDecisionsOf(project).length > 0,
        },
      ]
    }),
  )
</script>

<SlideChrome
  {portfolio}
  rail={railText(language, t('sidebar.overview', language))}
  {page}
  {total}
  {logo}
>
  {#snippet heading()}
    <div
      class="heading-row mt-(--slide-step) flex flex-none items-baseline justify-between gap-(--slide-gutter) print:mt-4 print:gap-6"
    >
      <h2
        class="slide-heading mt-0 min-w-0 print:mt-4 text-[30px] leading-9 font-bold tracking-[-0.01em] print:text-[28.5px] print:leading-[34px]"
      >
        {t('recap.title', language)}
      </h2>
      {#if totalPages > 1}
        <span class="heading-note text-[12.5px] whitespace-nowrap print:text-[12px]">
          {t('recap.page', language, { page: pageNumber, total: totalPages })}
        </span>
      {/if}
    </div>
  {/snippet}

  {#snippet footMid()}
    {#if nextPageCount > 0}
      {t('recap.next', language, { n: nextPageCount, page: pageNumber + 1 })}
    {/if}
  {/snippet}

  {@const TH =
    'px-[9px] py-[9px] text-xs leading-[1.45] font-bold tracking-[0.02em] print:px-1.5 print:text-[11.5px]'}
  {@const TD = 'px-[9px] py-1 align-middle print:px-1.5 print:py-[5px]'}
  <table class="table table--recap w-full table-fixed">
    <colgroup>
      <col style:width="50px" /><col style:width="232px" /><col style:width="196px" /><col
        style:width="174px"
      /><col style:width="90px" /><col style:width="132px" /><col style:width="173px" /><col
        style:width="74px"
      />
    </colgroup>
    <thead>
      <tr>
        {#each headers as header, i (i)}
          <th class={i === headers.length - 1 ? `${TH} text-center` : `${TH} text-left`}
            >{header}</th
          >
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.project.id)}
        <tr class="h-10 print:h-11">
          <td class="num {TD} text-[12.5px] font-bold print:text-[12px]">{row.project.id}</td>
          <td class="name {TD} text-[13px] leading-[1.22] print:text-[12px]">{row.project.name}</td>
          <td class="{TD} text-[13px] print:text-[12.5px]" style:--cat={row.color}
            ><span
              class="pill inline-flex h-5 items-center px-2 text-[11px] font-bold whitespace-nowrap print:h-[19px] print:px-[5px] print:text-[9.5px]"
              >{categoryName(row.category, language)}</span
            ></td
          >
          <td class="{TD} text-[13px] print:text-[12.5px]"
            ><StageChip project={row.project} {language} compact /></td
          >
          <td class="{TD} text-[13px] print:text-[12.5px]"
            ><HealthDot health={row.project.health} {language} /></td
          >
          <td class="{TD} text-[13px] print:text-[12.5px]"
            ><ProgressGauge gauge={projectGauge(row.project)} {language} /></td
          >
          <td
            class="milestone {TD} text-xs leading-[1.2] print:text-[11px]"
            class:late={row.late}
            class:dim={row.milestone === undefined}
          >
            {#if row.milestone}
              {displayLabel(row.milestone.label)}
              <span class="dim">
                — {row.milestone.display ?? formatShortDate(row.milestone.date)}
              </span>
            {:else}
              {t('priority.none', language)}
            {/if}
          </td>
          <td class="{TD} text-center text-[13px] print:text-[12.5px]">
            {#if row.pending}<b
                class="decision-mark text-sm leading-none font-bold print:text-[13px]">✓</b
              >{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</SlideChrome>
