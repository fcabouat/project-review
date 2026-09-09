<script lang="ts">
  /**
   * Decisions (canonical mockup, frame 12): today's table, calibrated for
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
    <div class="heading-row">
      <h2 class="slide-heading">{t('decisions.title', language)}</h2>
      <span class="heading-notes">
        {#if totalPages > 1}
          <span class="heading-note">
            {t('recap.page', language, { page: pageNumber, total: totalPages })}
          </span>
        {/if}
        <span class="heading-note">{t('decisions.note', language)}</span>
      </span>
    </div>
  {/snippet}

  <div class="label label--accent today">{t('decisions.today', language)}</div>
  <table class="table table--decisions today-table">
    <colgroup>
      <col style:width="21%" /><col style:width="30%" /><col style:width="11%" /><col
        style:width="26%"
      /><col style:width="12%" />
    </colgroup>
    <thead>
      <tr>
        {#each headers as header, i (i)}
          <th>{header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      <!-- `:` separator: "P-1"+11 and "P-11"+1 must not share a key. -->
      {#each rows as row (`${row.ref.projectId}:${row.ref.index}`)}
        <tr style:--cat={row.color}>
          <td>
            <span class="project-cell">
              <span class="id-chip">{row.project.id}</span>
              <span class="name">{row.project.name}</span>
            </span>
          </td>
          <td class="question">{row.decision.question}</td>
          <td class="who">{row.decision.decider ?? ''}</td>
          <td><span class="write-line"></span></td>
          <td><span class="write-line"></span></td>
        </tr>
      {/each}
    </tbody>
  </table>
</SlideChrome>

<style>
  /* the two measures the mockup carries inline on this slide alone */
  .today {
    margin-top: 10px;
  }
  .today-table {
    margin-top: 5px;
  }
</style>
