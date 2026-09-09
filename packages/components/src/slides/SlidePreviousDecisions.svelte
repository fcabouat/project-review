<script lang="ts">
  /**
   * Record of the previous review: accountability
   * appendix, entirely derived (decisions settled since `previousReviewDate`).
   * Nothing to fill in here — hence the airy rows and no writing zone.
   * Very last slide of the deck, apart from closing free slides.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import {
    categoryOf,
    decisionByRef,
    projectById,
    takenDecisionsSinceLastReview,
  } from '@project-review/core/projections'
  import { catColor } from '../commons/cat-color'
  import { formatLongDate, formatShortDate, t } from '@project-review/core/services/i18n'
  import TextLine from '../commons/TextLine.svelte'
  import SlideChrome from './SlideChrome.svelte'
  import { columns, railText } from './labels'

  interface Props {
    readonly portfolio: Portfolio
    readonly page?: number
    readonly total?: number
    readonly logo?: string
  }

  let { portfolio, page, total, logo }: Props = $props()

  const language = $derived(portfolio.settings.language)

  const headers = $derived(columns('prevDecisions.columns', language))

  const rows = $derived(
    takenDecisionsSinceLastReview(portfolio).flatMap((ref) => {
      const project = projectById(portfolio, ref.projectId)
      const decision = decisionByRef(portfolio, ref)
      if (!project || !decision?.taken) return []
      return [
        {
          ref,
          project,
          decision,
          outcome: decision.taken,
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
        {t('prevDecisions.title', language)}
      </h2>
      {#if portfolio.review.previousReviewDate}
        <span class="heading-note text-[12.5px] whitespace-nowrap print:text-[12px]">
          {t('prevDecisions.since', language, {
            date: formatLongDate(portfolio.review.previousReviewDate, language),
          })}
        </span>
      {/if}
    </div>
  {/snippet}

  {@const TH =
    'px-2.5 py-1.5 text-left text-xs leading-[1.45] font-bold tracking-[0.02em] print:px-[9px] print:py-[7px] print:text-[11.5px]'}
  {@const TD = 'px-2.5 py-2.5 align-middle print:px-[9px] print:py-[7px]'}
  <table class="table table--decisions table--record w-full table-fixed">
    <colgroup>
      <col style:width="24%" /><col style:width="30%" /><col style:width="26%" /><col
        style:width="10%"
      /><col style:width="10%" />
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
        <tr class="h-[68px] print:h-[66px]" style:--cat={row.color}>
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
          <!-- the outcome is entered in the micro-format: bold + dimmed suffix -->
          <td class="taken {TD}"><TextLine text={row.outcome.text} /></td>
          <td class="who {TD} text-[12.5px] print:text-[11.5px]">{row.decision.decider ?? ''}</td>
          <td class="who {TD} text-[12.5px] print:text-[11.5px]"
            >{formatShortDate(row.outcome.when)}</td
          >
        </tr>
      {/each}
    </tbody>
  </table>
</SlideChrome>
