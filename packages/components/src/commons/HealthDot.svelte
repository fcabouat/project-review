<script lang="ts">
  /**
   * Health: dot + label. Three shapes, same colors —
   * `text` (recap table, `.health`), `chip` (sheet banner, `.level--<level>`)
   * and `dot` (projects table: the dot alone, the label as its tooltip).
   * Not being assessed is a state of its own: "Non évalué", grey.
   */
  import type { HealthLevel } from '@project-review/core/model/project'
  import type { Language } from '@project-review/core/model/theme'
  import { t } from '@project-review/core/services/i18n'

  interface Props {
    /** `undefined` = not assessed. */
    readonly health?: HealthLevel
    readonly language: Language
    readonly shape?: 'text' | 'chip' | 'dot'
  }

  let { health, language, shape = 'text' }: Props = $props()

  // `notAssessed` is an i18n catalog key, not a code name: it stays as is.
  const key = $derived(health ?? 'notAssessed')
  const label = $derived(t(`level.${key}`, language))
</script>

<span
  class="health level--{key}"
  class:chip={shape === 'chip'}
  title={shape === 'dot' ? label : undefined}
>
  <i class="dot"></i>{#if shape !== 'dot'}{label}{/if}
</span>

<style>
  .health {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--txt);
    white-space: nowrap;
  }
  .dot {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex: none;
    background: var(--dot);
  }

  /* chip shape: the text takes the level hue, hairline included */
  .chip {
    height: 24px;
    padding: 0 9px;
    border-radius: 999px;
    font-weight: 600;
    color: var(--dot-txt);
    background: var(--dot-bg);
    border: 1px solid transparent;
    border-color: color-mix(in srgb, currentColor 25%, transparent);
  }

  /* Modifier suffixes are HealthLevel values / catalog keys: French on purpose. */
  .level--notAssessed {
    --dot: var(--ne);
    --dot-txt: var(--ne);
    --dot-bg: var(--ne-bg);
  }
  .level--onTrack {
    --dot: var(--ok);
    --dot-txt: var(--ok);
    --dot-bg: var(--ok-bg);
  }
  .level--watch {
    --dot: var(--vig-dot);
    --dot-txt: var(--vig-txt);
    --dot-bg: var(--vig-bg);
  }
  .level--alert {
    --dot: var(--warn);
    --dot-txt: var(--warn);
    --dot-bg: var(--warn-bg);
  }
  .level--critical {
    --dot: var(--err);
    --dot-txt: var(--err);
    --dot-bg: var(--err-bg);
  }
</style>
