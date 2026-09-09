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
    <div class="heading-row">
      <h2 class="slide-heading">{t('recap.title', language)}</h2>
      {#if totalPages > 1}
        <span class="heading-note">
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

  <table class="table table--recap">
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
          <th class={i === headers.length - 1 ? 'center' : ''}>{header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.project.id)}
        <tr>
          <td class="num">{row.project.id}</td>
          <td class="name">{row.project.name}</td>
          <td style:--cat={row.color}
            ><span class="pill">{categoryName(row.category, language)}</span></td
          >
          <td><StageChip project={row.project} {language} compact /></td>
          <td><HealthDot health={row.project.health} {language} /></td>
          <td><ProgressGauge gauge={projectGauge(row.project)} {language} /></td>
          <td class="milestone" class:late={row.late} class:dim={row.milestone === undefined}>
            {#if row.milestone}
              {displayLabel(row.milestone.label)}
              <span class="dim">
                — {row.milestone.display ?? formatShortDate(row.milestone.date)}
              </span>
            {:else}
              {t('priority.none', language)}
            {/if}
          </td>
          <td class="center">
            {#if row.pending}<b class="decision-mark">✓</b>{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</SlideChrome>
