<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import ProgressGauge from '../../src/commons/ProgressGauge.svelte'
  import { language } from './story-data'
  import { progressRamp, type Gauge } from '@project-review/core/projections'

  // The bands come from `progressRamp`: the story restates no threshold.
  const VALUES = [0, 20, 50, 80, 100]
  const GAUGES: readonly { readonly title: string; readonly gauge: Gauge }[] = [
    ...VALUES.map((pct) => ({
      title: `${pct} %`,
      gauge: { type: 'value', pct, band: progressRamp(pct) } as Gauge,
    })),
    // P-05 (stage "ready"): pitfall n° 3 — no progress before launch.
    { title: 'not assessed', gauge: { type: 'notAssessed' } as Gauge },
  ]

  const { Story } = defineMeta({
    title: 'Atoms/ProgressGauge',
    component: ProgressGauge,
    args: { language },
    parameters: {
      docs: {
        description: {
          component:
            'Track + fill in the band color (`progressRamp`). 0 % keeps a 3 px wick — a bar must not lie by vanishing. "Not assessed": full grey track and "—", never a red bar on a healthy project.',
        },
      },
    },
  })
</script>

<Story name="Gallery" asChild>
  <div class="grid">
    {#each GAUGES as g (g.title)}
      <span class="title">{g.title}</span>
      <ProgressGauge gauge={g.gauge} {language} />
      <ProgressGauge gauge={g.gauge} {language} width="76px" thin value="before" />
    {/each}
  </div>
</Story>

<style>
  .grid {
    display: grid;
    grid-template-columns: auto auto auto;
    align-items: center;
    gap: 12px 27px;
    justify-content: start;
  }
  .title {
    font-size: 12px;
    color: var(--muted);
  }
</style>
