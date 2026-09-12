<script lang="ts">
  /**
   * Decisions: today's table, calibrated for
   * handwriting — the two right-hand columns are 52 px writing zones.
   * Paginated by 7; the "page i / n" mention only shows when there is more than
   * one page.
   */
  import type { DecisionRef } from '@project-review/core/projections/slide'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { categoryOf, decisionByRef, projectById } from '@project-review/core/projections'
  import { catColor } from '../commons/cat-color'
  import { t } from '@project-review/core/services/i18n'
  import SlideChrome from './SlideChrome.svelte'
  import { columns, railText } from './labels'

  interface Props {
    readonly portfolio: Portfolio
    readonly entries: readonly DecisionRef[]
    readonly pageNumber: number
    readonly totalPages: number
    readonly page?: number
    readonly total?: number
    readonly logo?: string
  }

  let { portfolio, entries, pageNumber, totalPages, page, total, logo }: Props = $props()

  const language = $derived(portfolio.settings.language)
  const headers = $derived(columns('decisions.columns', language))

  const rows = $derived(
    entries.flatMap((ref) => {
      const project = projectById(portfolio, ref.projectId)
      const decision = decisionByRef(portfolio, ref)
      if (!project || !decision) return []
      return [
        {
          ref,
          project,
          decision,
          color: catColor(categoryOf(portfolio, project.categoryId).color),
        },
      ]
    }),
  )
</script>

<SlideChrome
  {portfolio}
  rail={railText(language, t('sidebar.decisions', language))}
  {page}
  {total}
  {logo}
  bodyClass="slide-body--tight"
>
  {#snippet heading()}
    <div
      class="heading-row mt-(--slide-step) flex flex-none items-baseline justify-between gap-(--slide-gutter) print:mt-4 print:gap-6"
    >
      <h2
        class="slide-heading mt-0 min-w-0 print:mt-4 text-[30px] leading-9 font-bold tracking-[-0.01em] print:text-[28.5px] print:leading-[34px]"
      >
        {t('decisions.title', language)}
      </h2>
      <span class="flex flex-none items-baseline gap-3">
        {#if totalPages > 1}
          <span class="heading-note text-[12.5px] whitespace-nowrap print:text-[12px]">
            {t('recap.page', language, { page: pageNumber, total: totalPages })}
          </span>
        {/if}
        <span class="heading-note text-[12.5px] whitespace-nowrap print:text-[12px]"
          >{t('decisions.note', language)}</span
        >
      </span>
    </div>
  {/snippet}

  {@const TH =
    'px-2.5 py-1.5 text-left text-xs leading-[1.45] font-bold tracking-[0.02em] print:px-[9px] print:py-[7px] print:text-[11.5px]'}
  {@const TD = 'px-2.5 py-1.5 align-top print:px-[9px] print:py-[7px]'}
  <!-- the two measures this slide alone carries: label 10 over, table 5 under -->
  <div class="label label--accent mt-2.5">{t('decisions.today', language)}</div>
  <table class="table table--decisions mt-[5px] w-full table-fixed">
    <colgroup>
      <col style:width="21%" /><col style:width="30%" /><col style:width="11%" /><col
        style:width="26%"
      /><col style:width="12%" />
    </colgroup>
    <thead>
      <tr>
        {#each headers as header, i (i)}
          <th class={TH}>{header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      <!-- `:` separator: "P-1"+11 and "P-11"+1 must not share a key. -->
      {#each rows as row (`${row.ref.projectId}:${row.ref.index}`)}
        <tr class="h-16 print:h-[66px]" style:--cat={row.color}>
          <td class={TD}>
            <span class="project-cell block text-xs leading-[1.25] print:text-[11.5px]">
              <span
                class="id-chip float-left mr-[7px] inline-flex h-[15px] items-center px-[5px] text-[10.5px] font-bold tracking-[0.02em] whitespace-nowrap print:h-3.5 print:text-[10px]"
                >{row.project.id}</span
              >
              <span class="name text-xs leading-[1.25] font-semibold print:text-[11.5px]"
                >{row.project.name}</span
              >
            </span>
          </td>
          <td class="question {TD} text-[12.5px] leading-[1.32] print:text-[12px]"
            >{row.decision.question}</td
          >
          <td class="who {TD} text-xs leading-[1.45] print:text-[11.5px]"
            >{row.decision.decider ?? ''}</td
          >
          <td class={TD}><span class="write-line block h-13"></span></td>
          <td class={TD}><span class="write-line block h-13"></span></td>
        </tr>
      {/each}
    </tbody>
  </table>
</SlideChrome>
