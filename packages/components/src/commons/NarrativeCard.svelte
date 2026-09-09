<script lang="ts">
  /**
   * One column of the review narrative (band 2 of the sheet): colored disc +
   * icon, heading in small caps, then the bullets in the micro-format.
   * Three variants only — done (green), in progress (blue), next steps (light
   * blue): the disc color tells the tense of the verb.
   */
  import type { Language } from '@project-review/core/model/theme'
  import { t } from '@project-review/core/services/i18n'
  import Icon, { type IconName } from './Icon.svelte'
  import TextLine from './TextLine.svelte'

  /** Variant names are `Project` list keys and i18n keys: French on purpose. */
  export type NarrativeVariant = 'done' | 'ongoing' | 'next'

  const ICON: Record<NarrativeVariant, IconName> = {
    done: 'check-line',
    ongoing: 'time-line',
    next: 'arrow-right-line',
  }

  interface Props {
    readonly variant: NarrativeVariant
    readonly lines: readonly string[]
    readonly language: Language
  }

  let { variant, lines, language }: Props = $props()

  const heading = $derived(t(`sheet.${variant}`, language))
</script>

<div class="col var--{variant}">
  <div class="ch">
    <span class="disc"><Icon name={ICON[variant]} size="14px" /></span>{heading}
  </div>
  {#if lines.length > 0}
    <ul class="bul">
      {#each lines as line, i (i)}
        <TextLine text={line} bullet />
      {/each}
    </ul>
  {/if}
</div>

<style>
  .col {
    min-width: 0;
    overflow: hidden;
  }
  .ch {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--txt2);
  }
  /* disc + inlined icon: flex centering, no optical offset */
  .disc {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    flex: none;
    color: #fff;
    line-height: 0; /* cross-audit: without it the line box inflates the disc by 2px */
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--disc);
  }
  .bul {
    margin-top: 8px;
    list-style: none;
    padding: 0;
  }

  .var--done {
    --disc: var(--ok);
  }
  .var--ongoing {
    --disc: var(--accent);
  }
  .var--next {
    --disc: var(--accent-main);
  }
</style>
