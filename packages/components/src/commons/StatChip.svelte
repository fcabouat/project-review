<script module lang="ts">
  /**
   * D1 dashboard indicator: a figure, a label, a tinted ground.
   * The tone carries the meaning (neutral / accent / watch / alert / good) —
   * the one thing the figure does not say.
   */
  export type StatTone = 'neutral' | 'accent' | 'alert' | 'critical' | 'good'
</script>

<script lang="ts">
  interface Props {
    readonly value: number | string
    readonly label: string
    readonly tone?: StatTone
  }

  let { value, label, tone = 'neutral' }: Props = $props()
</script>

<div class="stat tone--{tone}">
  <b>{value}</b><span>{label}</span>
</div>

<style>
  .stat {
    flex: 1;
    min-width: 0;
    height: 88px;
    border-radius: 8px;
    padding: 13px 15px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: var(--ground);
    color: var(--ink);
  }
  .stat b {
    font-size: 30px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .stat span {
    font-size: 12px;
    line-height: 1.25;
    font-weight: 600;
  }

  .tone--neutral {
    --ground: var(--accent-975);
    --ink: var(--accent);
  }
  .tone--accent {
    --ground: var(--accent-925);
    --ink: var(--accent);
  }
  .tone--alert {
    --ground: var(--warn-bg);
    --ink: var(--warn);
  }
  .tone--critical {
    --ground: var(--err-bg);
    --ink: var(--err);
  }
  .tone--good {
    --ground: var(--ok-bg);
    --ink: var(--ok);
  }
</style>
