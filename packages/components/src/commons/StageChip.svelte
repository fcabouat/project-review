<script lang="ts">
  /**
   * Stage chip (`.chip` + `.chip--*`). The
   * `color-mix(currentColor 25%)` hairline is carried by `.chip`; without it the
   * pale backgrounds vanish on zebra rows and in print.
   * "on hold" reads as a second chip stuck to the first.
   */
  import type { Language } from '@project-review/core/model/theme'
  import type { Project, Stage } from '@project-review/core/model/project'
  import { ARCHIVED_STAGES } from '@project-review/core/model/project'
  import { isTracked } from '@project-review/core/projections'
  import { t } from '@project-review/core/services/i18n'

  interface Props {
    /** Either a project, or the stage/on-hold pair: never both. */
    readonly project?: Project
    readonly stage?: Stage
    readonly onHold?: boolean
    readonly language: Language
    /** Tightened metrics of the recap table (`.rtbl .chip`). */
    readonly compact?: boolean
  }

  let { project, stage, onHold, language, compact = false }: Props = $props()

  const displayedStage = $derived<Stage>(project?.stage ?? stage ?? 'toScope')
  const held = $derived(project?.onHold ?? onHold ?? false)
  // Tracked = not archived. Over a bare stage the domain list says it
  // directly — no `Project` to fabricate for `isTracked`.
  const tracked = $derived(project ? isTracked(project) : !ARCHIVED_STAGES.includes(displayedStage))
</script>

<span class="group" class:compact>
  <span class="chip chip--{displayedStage}">{t(`stage.${displayedStage}`, language)}</span>
  {#if held && tracked}
    <span class="chip chip--onHold sfx">{t('stage.onHold', language)}</span>
  {/if}
</span>

<style>
  .group {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    /* fallback: stable metrics, then a hairline in the text hue */
    border: 1px solid transparent;
    border-color: color-mix(in srgb, currentColor 25%, transparent);
  }
  .compact .chip {
    height: 21px;
    font-size: 11.5px;
    padding: 0 8px;
    gap: 5px;
  }
  .compact .sfx {
    font-size: 10px;
    padding: 0 5px;
  }

  /* Modifier suffixes are Stage values: French, part of the data contract. */
  .chip--toScope {
    background: #eee;
    color: var(--txt2);
  }
  .chip--ready {
    background: var(--accent-925);
    color: var(--accent);
  }
  .chip--inProgress {
    background: var(--accent-975);
    color: var(--accent);
    font-weight: 700;
  }
  .chip--residuals {
    background: var(--ok-bg);
    color: var(--ok);
  }
  .chip--closed {
    background: #eee;
    color: #666;
  }
  .chip--abandoned {
    background: var(--err-bg);
    color: var(--err);
  }
  .chip--onHold {
    background: var(--vig-bg);
    color: var(--vig-txt);
  }
</style>
