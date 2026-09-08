<script lang="ts">
  /**
   * The risks band of the sheet's row C (v2.1 canon): a band with a left rule
   * whose TONE is the project's health, in five states — the derivation lives
   * in the domain (`risksLevel`), never here.
   *
   *   neutral    grey, title "Risks & watch items", body "RAS": nothing said
   *   confiance  green, check icon: the band is not always bad news
   *   vigilance  amber · alerte  orange · critique  red
   *
   * The tone is carried by a modifier class and not by inline colors, so that
   * `print.css` can transpose the band to A4 without restating the palette.
   */
  import type { RisksBand } from '@project-review/core/projections'
  import type { Language } from '@project-review/core/model/theme'
  import { t } from '@project-review/core/services/i18n'
  import Icon from './Icon.svelte'

  interface Props {
    readonly level: RisksBand
    /** The project's risks text; empty ⇒ the neutral "RAS" band. */
    readonly text?: string
    readonly language: Language
  }

  let { level, text, language }: Props = $props()

  /** Neutral keeps the generic title: there is no level to name. */
  const title = $derived(
    level === 'neutral' ? t('sheet.risks', language) : t(`sheet.risks.${level}`, language),
  )
  const icon = $derived(level === 'onTrack' ? 'check-line' : 'alert-line')
</script>

<div class="risks risks--{level}">
  <span class="label">
    <Icon name={icon} size="14px" />{title}
  </span>
  {#if text}
    <p>{text}</p>
  {:else}
    <p class="none">{t('sheet.risksNone', language)}</p>
  {/if}
</div>

<style>
  .risks {
    flex: 1;
    min-width: 0;
    border-radius: 4px;
    padding: 9px 14px;
    /* line-height 0 on the box: the inline label adds no leading of its own */
    line-height: 0;
    background: var(--bg-alt);
    border-left: 4px solid #9ca3af;
  }
  .risks--onTrack {
    background: #f0fdf4;
    border-left-color: #16a34a;
  }
  .risks--watch {
    background: #fffbeb;
    border-left-color: #d97706;
  }
  .risks--alert {
    background: #fff7ed;
    border-left-color: #c2410c;
  }
  .risks--critical {
    background: #fef2f2;
    border-left-color: #dc2626;
  }
  .label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    letter-spacing: 0.05em;
    line-height: 1.2;
    color: var(--muted);
  }
  .risks--onTrack .label {
    color: #166534;
  }
  .risks--watch .label {
    color: #92400e;
  }
  .risks--alert .label {
    color: var(--warn);
  }
  .risks--critical .label {
    color: var(--err);
  }
  p {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.35;
    color: var(--txt2);
  }
  .none {
    font-style: italic;
    color: var(--muted);
  }
</style>
