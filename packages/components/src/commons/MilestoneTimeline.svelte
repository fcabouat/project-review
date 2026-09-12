<script lang="ts">
  /**
   * Milestone timeline: LINEAR time axis bounded to [8 %, 92 %], filled dots for
   * the past / hollow for the upcoming / red for the overdue, and the red
   * "revue du …" cursor. The states come from `milestoneState` — date comparison
   * is not redone here.
   * Automatic staggering as soon as two milestones crowd (case P-09).
   */
  import type { Language } from '@project-review/core/model/theme'
  import type { Milestone } from '@project-review/core/model/project'
  import type { IsoDate } from '@project-review/core/values/date'
  import { milestoneState } from '@project-review/core/projections'
  import { formatShortDate, t } from '@project-review/core/services/i18n'
  import { needsStagger, withinScale, scaleOf, positionPct } from './time-scale'
  import { displayLabel } from './display'

  interface Props {
    readonly milestones: readonly Milestone[]
    readonly reviewDate: IsoDate
    readonly language: Language
    readonly withLegend?: boolean
  }

  let { milestones, reviewDate, language, withLegend = true }: Props = $props()

  const sorted = $derived(
    [...milestones].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
  )
  const scale = $derived(scaleOf(sorted.map((m) => m.date)))

  const points = $derived(
    scale === undefined
      ? []
      : sorted.map((m) => ({
          milestone: m,
          left: positionPct(m.date, scale),
          state: milestoneState(m, reviewDate),
          // `display` wins: "T2 2027" beats a false day-level precision.
          date: m.display ?? formatShortDate(m.date),
        })),
  )

  const staggered = $derived(needsStagger(points.map((p) => p.left)))
  const cursor = $derived(
    scale !== undefined && withinScale(reviewDate, scale)
      ? positionPct(reviewDate, scale)
      : undefined,
  )
</script>

<div class="block">
  <div class="tl" class:tl--alt={staggered}>
    <div class="tl-axis"></div>
    {#if cursor !== undefined}
      <div class="tl-cursor" style:left="{cursor}%"></div>
    {/if}
    {#each points as p, i (i)}
      <div
        class="tl-pt state--{p.state}"
        class:up={staggered && i % 2 === 0}
        class:dn={staggered && i % 2 === 1}
        style:left="{p.left}%"
      >
        <span class="tl-lab">{displayLabel(p.milestone.label)}</span>
        <span class="tl-dot"></span>
        <span class="tl-date">{p.date}</span>
      </div>
    {/each}
  </div>
  {#if withLegend}
    <div class="tlg">
      <i class="tlg-c"></i>{t('timeline.reviewOf', language, { date: formatShortDate(reviewDate) })}
      &nbsp;·&nbsp;
      <i class="tlg-d"></i>{t('timeline.past', language)}
      &nbsp;·&nbsp;
      <i class="tlg-o"></i>{t('timeline.upcoming', language)}
    </div>
  {/if}
</div>

<style>
  .block {
    /* Fallback if the parent has not resolved the category color: never transparent.
       (distinct variable: "--cat: var(--cat, …)" would be a CSS cycle) */
    --tint: var(--cat, var(--accent));
  }
  /* top hairline, height 78, axis at 40 — the sheet's timeline dimensions */
  .tl {
    position: relative;
    height: 78px;
    padding-top: 6px;
    border-top: 1px solid var(--border2);
  }
  .tl-axis {
    position: absolute;
    left: 0;
    right: 0;
    top: 40px;
    height: 2px;
    background: var(--border);
  }
  .tl-cursor {
    position: absolute;
    top: 28px;
    height: 24px;
    width: 2px;
    margin-left: -1px;
    background: var(--err);
  }
  .tl-pt {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
  }
  .tl-dot {
    position: absolute;
    top: 35px;
    left: 0;
    width: 12px;
    height: 12px;
    margin-left: -6px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid var(--tint);
    box-sizing: border-box;
  }
  .state--done .tl-dot {
    background: var(--tint);
  }
  /* lateness is flagged in red, in unison with the cursor and the health
     dashboard's late-milestone inset */
  .state--overdue .tl-dot {
    border-color: var(--err);
  }
  .state--overdue .tl-date {
    color: var(--err);
    font-weight: 600;
  }
  .tl-lab {
    position: absolute;
    left: 0;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--accent);
    top: 14px;
  }
  .tl-date {
    position: absolute;
    left: 0;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 10.5px;
    line-height: 1.2;
    color: var(--muted);
    top: 52px;
  }
  /* staggering: label + date above (up) or below (dn) */
  .tl--alt .tl-pt.up .tl-lab {
    top: 2px;
  }
  .tl--alt .tl-pt.up .tl-date {
    top: 17px;
  }
  .tl--alt .tl-pt.dn .tl-lab {
    top: 48px;
  }
  .tl--alt .tl-pt.dn .tl-date {
    top: 63px;
  }

  .tlg {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: var(--muted);
  }
  .tlg i {
    display: inline-block;
    margin-right: 5px;
  }
  .tlg-c {
    width: 2px;
    height: 10px;
    background: var(--err);
  }
  .tlg-d {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--tint);
  }
  .tlg-o {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--tint);
  }
</style>
