<script lang="ts">
  /**
   * Record of the previous review (canonical mockup, frame 14): accountability
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
    <div class="heading-row">
      <h2 class="slide-heading">{t('prevDecisions.title', language)}</h2>
      {#if portfolio.review.previousReviewDate}
        <span class="heading-note">
          {t('prevDecisions.since', language, {
            date: formatLongDate(portfolio.review.previousReviewDate, language),
          })}
        </span>
      {/if}
    </div>
  {/snippet}

  <table class="table table--decisions table--record">
    <colgroup>
      <col style:width="24%" /><col style:width="30%" /><col style:width="26%" /><col
        style:width="10%"
      /><col style:width="10%" />
    </colgroup>
    <thead>
      <tr>
        {#each headers as header, i (i)}
          <th>{header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.ref.projectId + row.ref.index)}
        <tr style:--cat={row.color}>
          <td>
            <span class="project-cell">
              <span class="id-chip">{row.project.id}</span>
              <span class="name">{row.project.name}</span>
            </span>
          </td>
          <td class="question">{row.decision.question}</td>
          <!-- the outcome is entered in the micro-format: bold + dimmed suffix -->
          <td class="taken"><TextLine text={row.outcome.text} /></td>
          <td class="who">{row.decision.decider ?? ''}</td>
          <td class="who">{formatShortDate(row.outcome.when)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</SlideChrome>
