<script lang="ts">
  /**
   * The risks band of the sheet's row C: a band with a left rule
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
    /* The band's tones are a LOCAL scale, pinned here and not mapped onto the
       global health tokens (--ok, --ok-bg, …): the band reads at 12 px on a
       grey card, so its greens and ambers are calibrated for that ground and
       must not move when the chrome scale is retuned. Values identical to the
       previous inline literals — tokenised, not re-tinted. */
    --risks-rule: #9ca3af;
    --risks-ok-bg: #f0fdf4;
    --risks-ok-rule: #16a34a;
    --risks-ok-ink: #166534;
    --risks-watch-bg: #fffbeb;
    --risks-watch-rule: #d97706;
    --risks-watch-ink: #92400e;
    --risks-alert-bg: #fff7ed;
    --risks-alert-rule: #c2410c;
    --risks-critical-bg: #fef2f2;
    --risks-critical-rule: #dc2626;

    flex: 1;
    min-width: 0;
    border-radius: 4px;
    padding: 9px 14px;
    /* line-height 0 on the box: the inline label adds no leading of its own */
    line-height: 0;
    background: var(--bg-alt);
    border-left: 4px solid var(--risks-rule);
  }
  .risks--onTrack {
    background: var(--risks-ok-bg);
    border-left-color: var(--risks-ok-rule);
  }
  .risks--watch {
    background: var(--risks-watch-bg);
    border-left-color: var(--risks-watch-rule);
  }
  .risks--alert {
    background: var(--risks-alert-bg);
    border-left-color: var(--risks-alert-rule);
  }
  .risks--critical {
    background: var(--risks-critical-bg);
    border-left-color: var(--risks-critical-rule);
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
    color: var(--risks-ok-ink);
  }
  .risks--watch .label {
    color: var(--risks-watch-ink);
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
