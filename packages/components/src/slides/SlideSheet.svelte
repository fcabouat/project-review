<script lang="ts">
  /**
   * Project sheet (canonical mockup, frames 08, 10 and 11) — the reference
   * template, "v2.1 bands":
   *   row A  goal BAND (elastic) + the merged FACTS block (338 px), both with
   *          a left rule, contents aligned to the top, height capped at 104 px;
   *   row B  three narrative cards in strict thirds, bullets centered;
   *   row C  risks (five tones) and decision, two bands in equal halves;
   *   then the dated timeline, its legend in the foot.
   * The rail and the timeline take the color of the category.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import {
    categoryOf,
    pendingDecisionsOf,
    projectById,
    risksLevel,
  } from '@project-review/core/projections'
  import { catColor } from '../commons/cat-color'
  import { formatShortDate, t } from '@project-review/core/services/i18n'
  import Icon from '../commons/Icon.svelte'
  import StageChip from '../commons/StageChip.svelte'
  import HealthDot from '../commons/HealthDot.svelte'
  import PriorityBadge from '../commons/PriorityBadge.svelte'
  import FactsBlock from '../commons/FactsBlock.svelte'
  import RisksBand from '../commons/RisksBand.svelte'
  import NarrativeCard, { type NarrativeVariant } from '../commons/NarrativeCard.svelte'
  import MilestoneTimeline from '../commons/MilestoneTimeline.svelte'
  import SlideChrome from './SlideChrome.svelte'
  import { categoryName, columns, fieldLabel, railText, withColon } from './labels'

  interface Props {
    readonly portfolio: Portfolio
    readonly projectId: string
    readonly page?: number
    readonly total?: number
    readonly logo?: string
  }

  let { portfolio, projectId, page, total, logo }: Props = $props()

  const language = $derived(portfolio.settings.language)
  /** 'flat' (canon F-03): kicker + title + chips + meta on the color plane. */
  const flat = $derived(portfolio.settings.theme.style === 'flat')
  const project = $derived(projectById(portfolio, projectId))
  const category = $derived(project ? categoryOf(portfolio, project.categoryId) : undefined)
  const color = $derived(category ? catColor(category.color) : undefined)
  /** Meta line: only the fields actually filled in — no empty "Sponsor : —". */
  const meta = $derived(
    (
      [
        ['sheet.lead', project?.lead],
        ['sheet.sponsor', project?.sponsor],
        ['sheet.scope', project?.scope],
      ] as const
    ).flatMap(([key, value]) => (value ? [{ key, value }] : [])),
  )

  const narratives = $derived<readonly { variant: NarrativeVariant; lines: readonly string[] }[]>([
    { variant: 'done', lines: project?.done ?? [] },
    { variant: 'ongoing', lines: project?.ongoing ?? [] },
    { variant: 'next', lines: project?.next ?? [] },
  ])

  /** Pitfall n° 4: a decision is pending as long as it has no outcome. */
  const pending = $derived(project ? pendingDecisionsOf(project) : [])
  const decision = $derived(pending[0])
  /** "Décideur" is the third column header of the decisions table. */
  const ownerLabel = $derived(columns('decisions.columns', language)[2] ?? '')
</script>

{#if project && category}
  <SlideChrome
    {portfolio}
    rail={railText(language, categoryName(category, language))}
    {page}
    {total}
    {logo}
    sheet
    tint={color}
  >
    {#snippet heading()}
      {#if flat}
        <!-- canon F-03: the id moves from the meta line up to the kicker -->
        <div class="flat-kicker">{categoryName(category, language)} · {project.id}</div>
        <h2>{project.name}</h2>
        <div class="flat-headrow">
          <StageChip {project} {language} />
          <HealthDot health={project.health} {language} shape="chip" />
          <PriorityBadge priority={project.priority} {language} />
          {#if meta.length > 0}
            <span class="flat-meta">
              {#each meta as item, i (item.key)}{#if i > 0}{' · '}{/if}{fieldLabel(
                  item.key,
                  language,
                )}<b>{item.value}</b>{/each}
            </span>
          {/if}
        </div>
      {:else}
        <div class="sheet-title">
          <h2>{project.name}</h2>
          <div class="sheet-chips">
            <StageChip {project} {language} />
            <HealthDot health={project.health} {language} shape="chip" />
            <PriorityBadge priority={project.priority} {language} />
          </div>
        </div>
        <div class="sheet-meta">
          {project.id}{#each meta as item (item.key)}{' · '}{fieldLabel(item.key, language)}<b
              >{item.value}</b
            >{/each}
        </div>
      {/if}
    {/snippet}

    <div class="sheet-body">
      <div class="row-a">
        <div class="goal">
          <div class="label label--accent">{t('sheet.goal', language)}</div>
          <p>{project.goal}</p>
        </div>
        <FactsBlock {project} {language} />
      </div>

      <div class="row-b">
        {#each narratives as narrative (narrative.variant)}
          <div class="narrative-card">
            <NarrativeCard variant={narrative.variant} lines={narrative.lines} {language} />
          </div>
        {/each}
      </div>

      <div class="row-c">
        <RisksBand level={risksLevel(project)} text={project.risks} {language} />
        <div class="decision" class:decision--none={decision === undefined}>
          <span class="label">
            <Icon name="scales-3-line" size="14px" />{t('sheet.decision', language)}
            {#if pending.length > 1}
              {t('sheet.decisionMore', language, { n: pending.length - 1 })}
            {/if}
          </span>
          <p>{decision?.question ?? t('sheet.decisionNone', language)}</p>
          {#if decision?.decider}
            <div class="decision-owner">{withColon(ownerLabel, language)}{decision.decider}</div>
          {/if}
        </div>
      </div>

      <MilestoneTimeline
        milestones={project.milestones}
        reviewDate={portfolio.review.reviewDate}
        {language}
        withLegend={false}
      />
    </div>

    {#snippet footMid()}
      <span class="timeline-legend">
        <i class="cursor"></i>{t('timeline.reviewOf', language, {
          date: formatShortDate(portfolio.review.reviewDate),
        })}
        &nbsp;·&nbsp;
        <i class="past"></i>{t('timeline.past', language)}
        &nbsp;·&nbsp;
        <i class="upcoming"></i>{t('timeline.upcoming', language)}
      </span>
    {/snippet}
  </SlideChrome>
{/if}
