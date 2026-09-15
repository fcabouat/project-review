<script lang="ts">
  /**
   * Readable milestone timeline; geometry is adjusted only when dates crowd.
   * Completion/overdue states come from the domain, never inferred here.
   */
  import type { Language } from '@project-review/core/model/theme'
  import type { Milestone } from '@project-review/core/model/project'
  import type { IsoDate } from '@project-review/core/values/date'
  import { milestoneState } from '@project-review/core/projections'
  import { formatShortDate, t } from '@project-review/core/services/i18n'
  import { timelineLayout } from './time-scale'
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
  const layout = $derived(
    timelineLayout(
      sorted.map((m) => m.date),
      reviewDate,
    ),
  )

  const points = $derived(
    sorted.map((m, i) => ({
      milestone: m,
      left: layout.positions[i],
      state: milestoneState(m, reviewDate),
      // `display` wins: "T2 2027" beats a false day-level precision.
      date: m.display ?? formatShortDate(m.date),
    })),
  )
</script>

<div class="block">
  <div class="tl" class:tl--alt={layout.staggered}>
    <div class="tl-axis"></div>
    {#if layout.cursor !== undefined}
      <div class="tl-cursor" style:left="{layout.cursor}%"></div>
    {/if}
    {#each points as p, i (i)}
      <div
        class="tl-pt state--{p.state}"
        class:dn={layout.staggered && i % 2 === 1}
        style:--position="{p.left}%"
      >
        <span class="tl-labels">
          <span class="tl-lab" title={displayLabel(p.milestone.label)}
            >{displayLabel(p.milestone.label)}</span
          >
          <span class="tl-date">{p.date}</span>
        </span>
        <span class="tl-dot"></span>
      </div>
    {/each}
  </div>
  {#if layout.adjusted}
    <div class="tl-note">{t('timeline.adjusted', language)}</div>
  {/if}
  {#if withLegend}
    <div class="tlg">
      <i class="tlg-c"></i>{t('timeline.reviewOf', language, { date: formatShortDate(reviewDate) })}
      &nbsp;·&nbsp;
      <i class="tlg-d"></i>{t('timeline.done', language)}
      &nbsp;·&nbsp;
      <i class="tlg-o"></i>{t('timeline.upcoming', language)}
      &nbsp;·&nbsp;
      <i class="tlg-l"></i>{t('timeline.overdue', language)}
    </div>
  {/if}
</div>

<style>
  .block {
    /* Fallback if the parent has not resolved the category color: never transparent.
       (distinct variable: "--cat: var(--cat, …)" would be a CSS cycle) */
    --tint: var(--cat, var(--accent));
  }
  .tl {
    --tl-axis: 56px;
    position: relative;
    height: 84px;
    border-top: 1px solid var(--border2);
  }
  .tl--alt {
    height: 116px;
  }
  .tl-axis {
    position: absolute;
    left: 0;
    right: 0;
    top: var(--tl-axis);
    height: 2px;
    background: var(--border);
  }
  .tl-cursor {
    position: absolute;
    top: calc(var(--tl-axis) - 12px);
    height: 24px;
    width: 2px;
    margin-left: -1px;
    background: var(--err);
  }
  .tl-pt {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .tl-dot {
    position: absolute;
    top: calc(var(--tl-axis) - 5px);
    left: var(--position);
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
  .tl-labels {
    position: absolute;
    left: var(--position);
    transform: translateX(-50%);
    width: 24%;
    bottom: calc(100% - var(--tl-axis) + 10px);
    text-align: center;
    pointer-events: auto;
  }
  .tl-lab {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--accent);
  }
  .tl-date {
    display: block;
    white-space: nowrap;
    font-size: 10.5px;
    line-height: 1.2;
    color: var(--muted);
    margin-top: 2px;
  }
  .tl-pt.dn .tl-labels {
    top: calc(var(--tl-axis) + 10px);
    bottom: auto;
  }
  .tl-note {
    text-align: right;
    font-size: 10px;
    line-height: 1.2;
    color: var(--muted);
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
  .tlg-l {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--err);
  }
</style>
