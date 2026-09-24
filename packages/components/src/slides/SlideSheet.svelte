<script lang="ts">
  /**
   * Project sheet — the reference
   * template, a banded composition:
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
    mostRecentTakenDecision,
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
  /** 'flat': kicker + title + chips + meta on the color plane. */
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
        [
          'sheet.scope',
          [project?.scopeTags?.join(' '), project?.scope].filter(Boolean).join(' · ') || undefined,
        ],
      ] as const
    ).flatMap(([key, value]) => (value ? [{ key, value }] : [])),
  )
  const metaText = $derived(
    meta.map((item) => `${fieldLabel(item.key, language)}${item.value}`).join(' · '),
  )

  const narratives = $derived<readonly { variant: NarrativeVariant; lines: readonly string[] }[]>([
    { variant: 'done', lines: project?.done ?? [] },
    { variant: 'ongoing', lines: project?.ongoing ?? [] },
    { variant: 'next', lines: project?.next ?? [] },
  ])

  /** A decision is pending as long as it has no outcome. */
  const pending = $derived(project ? pendingDecisionsOf(project) : [])
  const decision = $derived(pending[0] ?? (project ? mostRecentTakenDecision(project) : undefined))
  const decisionIsSettled = $derived(pending.length === 0 && decision?.taken !== undefined)
  /** The third column header of the decisions table (`decisions.columns`). */
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
        <!-- flat: the id moves from the meta line up to the kicker -->
        <div class="flat-kicker">
          {categoryName(category, language)}{#if project.reference}
            · {project.reference}{/if}
        </div>
        <h2>{project.name}</h2>
        <div class="flat-headrow">
          <StageChip {project} {language} />
          <HealthDot health={project.health} {language} shape="chip" />
          <PriorityBadge priority={project.priority} {language} />
          {#if meta.length > 0}
            <span class="flat-meta line-clamp-2 min-w-0 flex-1 break-words" title={metaText}>
              {#each meta as item, i (item.key)}{#if i > 0}{' · '}{/if}{fieldLabel(
                  item.key,
                  language,
                )}<b>{item.value}</b>{/each}
            </span>
          {/if}
        </div>
      {:else}
        <div
          class="sheet-title mt-2.5 flex flex-none items-start justify-between gap-(--slide-step) print:gap-4"
        >
          <h2
            class="min-w-0 text-[29px] leading-[35px] font-bold tracking-[-0.01em] print:text-[27.5px] print:leading-[33px]"
          >
            {project.name}
          </h2>
          <div class="mt-1 flex flex-none gap-2 print:gap-[7px]">
            <StageChip {project} {language} />
            <HealthDot health={project.health} {language} shape="chip" />
            <PriorityBadge priority={project.priority} {language} />
          </div>
        </div>
        <div
          class="sheet-meta mt-1.5 line-clamp-2 flex-none text-[13px] leading-[18px] break-words print:text-[12.5px] print:leading-[17px]"
          title={[project.reference, metaText].filter(Boolean).join(' · ')}
        >
          {#if project.reference}{project.reference}{/if}{#each meta as item, i (item.key)}{#if project.reference || i > 0}{' · '}{/if}{fieldLabel(
              item.key,
              language,
            )}<b>{item.value}</b>{/each}
        </div>
      {/if}
    {/snippet}

    <div class="sheet-body mt-[11px] flex min-h-0 flex-1 flex-col gap-3 print:mt-3 print:gap-2.5">
      <div
        class="row-a flex max-h-[104px] flex-none items-stretch gap-3 print:max-h-[100px] print:gap-[11px]"
      >
        <div
          class="goal flex min-w-0 flex-1 flex-col overflow-hidden px-4 py-[9px] print:px-[15px]"
        >
          <div class="label label--accent">{t('sheet.goal', language)}</div>
          <p class="mt-1 text-[13.5px] leading-[1.32] print:text-[13px]">{project.goal}</p>
        </div>
        <FactsBlock {project} {language} />
      </div>

      <div class="row-b grid min-h-0 flex-1 grid-cols-3 gap-3 print:gap-[11px]">
        {#each narratives as narrative (narrative.variant)}
          <div
            class="narrative-card flex min-w-0 flex-col overflow-hidden px-[13px] py-[9px] print:px-3"
          >
            <NarrativeCard variant={narrative.variant} lines={narrative.lines} {language} />
          </div>
        {/each}
      </div>

      <div class="row-c flex flex-none items-stretch gap-3 print:gap-[11px]">
        <RisksBand level={risksLevel(project)} text={project.risks} {language} />
        <div
          class="decision min-w-0 flex-1 px-3.5 py-[9px] [line-height:0] print:px-[13px]"
          class:decision--none={decision === undefined}
        >
          <span class="label">
            <Icon name="scales-3-line" size="14px" />{t(
              decisionIsSettled ? 'sheet.decisionTaken' : 'sheet.decision',
              language,
            )}
            {#if pending.length > 1}
              {t('sheet.decisionMore', language, { n: pending.length - 1 })}
            {/if}
          </span>
          <p class="mt-1 text-[13px] leading-[1.3] font-semibold print:text-[12.3px]">
            {decisionIsSettled
              ? decision!.taken!.text
              : (decision?.question ?? t('sheet.decisionNone', language))}
          </p>
          {#if decisionIsSettled && decision?.taken}
            <div class="decision-owner mt-[3px] text-[11px] leading-[1.2] print:text-[10.5px]">
              {formatShortDate(decision.taken.when)}
            </div>
          {/if}
          {#if decision?.decider && !decisionIsSettled}
            <div class="decision-owner mt-[3px] text-[11px] leading-[1.2] print:text-[10.5px]">
              {withColon(ownerLabel, language)}{decision.decider}
            </div>
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
        <i class="past"></i>{t('timeline.done', language)}
        &nbsp;·&nbsp;
        <i class="upcoming"></i>{t('timeline.upcoming', language)}
        &nbsp;·&nbsp;
        <i class="overdue"></i>{t('timeline.overdue', language)}
      </span>
    {/snippet}
  </SlideChrome>
{/if}
