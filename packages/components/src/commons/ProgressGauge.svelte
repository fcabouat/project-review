<script lang="ts">
  /**
   * Progress gauge: grey track + fill in the band color.
   * The band comes from `progressRamp` (through `projectGauge`) — no threshold is
   * restated here. Pitfall n° 3: before launch the gauge is "not assessed" (full
   * grey track, value "—"), never a red bar at 0 %.
   */
  import type { Gauge } from '@project-review/core/projections'
  import type { Language } from '@project-review/core/model/theme'
  import { t } from '@project-review/core/services/i18n'
  import { BAND_COLOR } from './band-color'

  interface Props {
    readonly gauge: Gauge
    readonly language: Language
    /** Track width (71 px in the recap table, 76 px in the facts bar). */
    readonly width?: string
    /** Thin track (6 px) of the facts bar; 8 px otherwise. */
    readonly thin?: boolean
    readonly value?: 'after' | 'before' | 'none'
  }

  let { gauge, language, width = '71px', thin = false, value = 'after' }: Props = $props()

  const band = $derived(gauge.type === 'value' ? gauge.band : 'grey')
  const pct = $derived(gauge.type === 'value' ? gauge.pct : 0)
  // Non-breaking space before "%": generated label (pitfall n° 7).
  // `priority.none` = the "missing value" em dash, identical fr/en: the only
  // catalog entry for that glyph, so we do not hard-code it here.
  const text = $derived(gauge.type === 'value' ? `${gauge.pct} %` : t('priority.none', language))
</script>

<!-- The fill color comes from the shared BAND_COLOR map — not restated in CSS. -->
<span
  class="gauge band--{band}"
  class:reversed={value === 'before'}
  style:--fill={BAND_COLOR[band]}
>
  <span class="bar" class:thin style:width>
    {#if gauge.type === 'value'}
      <i style:width="{pct}%"></i>
    {/if}
  </span>
  {#if value !== 'none'}
    <span class="gauge-val" class:dim={gauge.type === 'notAssessed'}>{text}</span>
  {/if}
</span>

<style>
  .gauge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .reversed {
    flex-direction: row-reverse;
  }
  .bar {
    position: relative;
    height: 8px;
    border-radius: 999px;
    background: #ededed;
    overflow: hidden;
    flex: none;
  }
  .bar.thin {
    height: 6px;
  }
  .bar i {
    position: absolute;
    inset: 0 auto 0 0;
    display: block;
    border-radius: 999px;
    background: var(--fill);
  }
  .gauge-val {
    font-size: 12px;
    font-weight: 600;
    color: var(--txt2);
    white-space: nowrap;
  }
  .dim {
    color: var(--muted);
  }

  /* Fully grey track when nothing is assessable: the mockup fills it — the grey
     itself comes from BAND_COLOR through the same `--fill` variable. */
  .band--grey .bar {
    background: var(--fill);
  }
  /* 0 % stays visible: a 3 px wick, otherwise the bar lies by vanishing. */
  .band--red .bar i {
    min-width: 3px;
  }
</style>
