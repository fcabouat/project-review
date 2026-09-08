<script lang="ts">
  /**
   * The sheet's merged FACTS block (row A, right side of the v2.1 canon): one
   * grey band with a left rule, holding the three dated columns — start, end,
   * progress — separated by hairlines, then the budget across the full width
   * under a rule.
   *
   * Two decisions of the canon are carried here and nowhere else:
   *   · progress is the BAR ALONE, full width of its column (1.12 of a share):
   *     the percentage is already said by the recap table, and repeating it in
   *     14 px would have cost the column its width;
   *   · the block is sized by its content (the row caps it at 104 px / 100 px
   *     A4), contents aligned to the TOP — a fact is read from the top down.
   */
  import type { Language } from '@project-review/core/model/theme'
  import type { Project } from '@project-review/core/model/project'
  import { projectGauge } from '@project-review/core/projections'
  import { formatShortDate, t } from '@project-review/core/services/i18n'
  import ProgressGauge from './ProgressGauge.svelte'

  interface Props {
    readonly project: Project
    readonly language: Language
  }

  let { project, language }: Props = $props()

  // `priority.none` is the catalog's em dash for a missing value: the same
  // glyph everywhere, never hard-coded in a template.
  const missing = $derived(t('priority.none', language))

  /** A finished project shows its actual end; the others their target end. */
  const end = $derived(
    project.actualEnd
      ? { key: 'sheet.actualEnd' as const, date: project.actualEnd }
      : { key: 'sheet.targetEnd' as const, date: project.targetEnd },
  )
</script>

<div class="facts">
  <div class="facts-row">
    <div class="fact">
      <div class="label">{t('sheet.start', language)}</div>
      <div class="value" class:dim={!project.start}>
        {project.start ? formatShortDate(project.start) : missing}
      </div>
    </div>
    <div class="fact">
      <div class="label">{t(end.key, language)}</div>
      <div class="value" class:dim={!end.date}>
        {end.date ? formatShortDate(end.date) : missing}
      </div>
    </div>
    <div class="fact fact--progress">
      <div class="label">{t('sheet.progress', language)}</div>
      <div class="track">
        <ProgressGauge gauge={projectGauge(project)} {language} width="100%" thin value="none" />
      </div>
    </div>
  </div>
  <div class="budget">
    <span class="label">{t('sheet.budget', language)}</span>
    <span class="budget-text" class:dim={!project.budget}>{project.budget ?? missing}</span>
  </div>
</div>

<style>
  /* the block has no width of its own: row A gives it one (338 px / 310 px A4) */
  .facts {
    background: var(--bg-alt);
    border-left: 4px solid #6b7280;
    border-radius: 4px;
    padding: 8px 0 9px;
    display: flex;
    flex-direction: column;
  }
  .facts-row {
    display: flex;
    align-items: stretch;
  }
  .fact {
    flex: 1;
    min-width: 0;
    padding: 0 12px;
  }
  /* the hairline belongs to the column, not to a separator element */
  .fact + .fact {
    border-left: 1px solid var(--border);
  }
  /* the bar needs the extra tenth the dates do not */
  .fact--progress {
    flex: 1.12;
  }
  /* same scale as every other slide label (mockup `.lab`) */
  .label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .value {
    margin-top: 3px;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.15;
    color: var(--txt);
  }
  .dim {
    color: var(--muted);
  }
  .track {
    margin-top: 7px;
  }
  /* the gauge atom is inline-flex by default: here it is a block, so that the
     track's own `width: 100%` resolves against the column and not against a
     shrink-to-fit box */
  .track :global(.gauge) {
    display: flex;
    width: 100%;
  }
  .budget {
    margin-top: 7px;
    padding: 6px 12px 0;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: baseline;
    gap: 9px;
    min-width: 0;
  }
  .budget-text {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--txt);
    /* clamped to 2 lines rather than truncated blind */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
