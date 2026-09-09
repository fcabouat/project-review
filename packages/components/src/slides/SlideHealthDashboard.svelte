<script lang="ts">
  /**
   * Health dashboard "For today's session": health
   * column 302 px with the overdue-milestone inset stuck to it, then the
   * pending decisions.
   * The table caps at 8 rows and says "+n more" — a slide that
   * scrolls is a slide that lies.
   */
  import type { HealthLevel } from '@project-review/core/model/project'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { HEALTH_LEVELS } from '@project-review/core/model/project'
  import {
    categoryOf,
    decisionByRef,
    healthBreakdown,
    isTracked,
    milestoneState,
    orderedProjects,
    pendingDecisions,
    projectById,
  } from '@project-review/core/projections'
  import { catColor } from '../commons/cat-color'
  import { formatShortDate, t } from '@project-review/core/services/i18n'
  import SlideChrome from './SlideChrome.svelte'
  import { displayLabel } from '../commons/display'
  import { railText } from './labels'

  interface Props {
    readonly portfolio: Portfolio
    readonly page?: number
    readonly total?: number
    readonly logo?: string
  }

  let { portfolio, page, total, logo }: Props = $props()

  /** 8 rows at most: beyond that the slide would overflow. */
  const MAX_ROWS = 8

  const language = $derived(portfolio.settings.language)

  const breakdown = $derived(healthBreakdown(portfolio))
  /** Levels in severity order, then "not assessed" — a state of its own. */
  const levels = $derived<readonly (HealthLevel | 'notAssessed')[]>([
    ...HEALTH_LEVELS,
    'notAssessed',
  ])
  const maxCount = $derived(Math.max(1, ...levels.map((l) => breakdown[l])))

  const overdue = $derived(
    orderedProjects(portfolio)
      .filter(isTracked)
      .flatMap((project) =>
        project.milestones
          // Index BEFORE filtering: `${id}:${index}` keys each row to its slot
          // in the project's milestone list — unique by construction, where a
          // label-based key could collide (two same-named milestones).
          .map((milestone, index) => ({ project, milestone, index }))
          .filter((x) => milestoneState(x.milestone, portfolio.review.reviewDate) === 'overdue'),
      ),
  )

  const rows = $derived(
    pendingDecisions(portfolio).flatMap((ref) => {
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
  const shown = $derived(rows.slice(0, MAX_ROWS))
  const hidden = $derived(rows.length - shown.length)
</script>

<SlideChrome
  {portfolio}
  rail={railText(language, t('sidebar.overview', language))}
  {page}
  {total}
  {logo}
  bodyClass="slide-body--split"
>
  {#snippet heading()}
    <h2 class="slide-heading">{t('d2.title', language)}</h2>
  {/snippet}

  <!-- left column: portfolio health -->
  <div class="health-column">
    <div class="label label--accent">{t('d2.health', language)}</div>
    <div class="health-rows">
      {#each levels as level (level)}
        <div class="health-row level--{level}">
          <span class="health-dot"></span>
          <span class="health-label">{t(`level.${level}`, language)}</span>
          <span class="health-count">{breakdown[level]}</span>
          <div class="health-bar">
            <i style:width="{(breakdown[level] / maxCount) * 100}%"></i>
          </div>
        </div>
      {/each}
    </div>
    {#if overdue.length > 0}
      <div class="callout">
        <div class="label">{t('d2.overdueMilestones', language, { n: overdue.length })}</div>
        {#each overdue as item (`${item.project.id}:${item.index}`)}
          <p>
            <b>{item.project.id}</b>
            {displayLabel(item.milestone.label)}
            <span class="dim"
              >— {item.milestone.display ?? formatShortDate(item.milestone.date)}</span
            >
          </p>
        {/each}
      </div>
    {/if}
  </div>

  <!-- right column: pending decisions -->
  <div class="pending-column">
    <div class="label label--accent">{t('d2.decisions', language)}</div>
    <table class="table table--pending">
      <colgroup>
        <col style:width="70px" />
        <col style:width="220px" />
        <col style:width="118px" />
        <col />
      </colgroup>
      <tbody>
        <!-- The ref (projectId + index in `decisions`) is the identity of a
             pending decision; the `:` separator keeps "P-1"+11 ≠ "P-11"+1. -->
        {#each shown as row (`${row.ref.projectId}:${row.ref.index}`)}
          <tr class="level--{row.project.health ?? 'notAssessed'}" style:--cat={row.color}>
            <td><span class="id-chip">{row.project.id}</span></td>
            <td class="name">{row.project.name}</td>
            <td class="who">{row.decision.decider ?? ''}</td>
            <td>{row.decision.question}</td>
          </tr>
        {/each}
        {#if hidden > 0}
          <tr class="more-row">
            <td colspan="4">{t('d2.more', language, { n: hidden })}</td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</SlideChrome>
