<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import StatChip, { type StatTone } from '../../src/commons/StatChip.svelte'
  import { sample, language } from './story-data'
  import { kpis } from '@project-review/core/projections'
  import { t, type CatalogKey } from '@project-review/core/services/i18n'

  // The six indicators of the portfolio dashboard, derived from the sample data set (17 / 11 / 2 / 1 / 7 / 1).
  const k = kpis(sample)
  const INDICATORS: readonly { value: number; key: CatalogKey; tone: StatTone }[] = [
    { value: k.tracked, key: 'kpi.tracked', tone: 'neutral' },
    { value: k.active, key: 'kpi.active', tone: 'accent' },
    { value: k.atRiskOrBlocked, key: 'kpi.atRiskOrBlocked', tone: 'alert' },
    { value: k.overdueMilestones, key: 'kpi.overdueMilestones', tone: 'critical' },
    { value: k.pendingDecisions, key: 'kpi.pendingDecisions', tone: 'neutral' },
    { value: k.doneWithResiduals, key: 'kpi.doneResiduals', tone: 'good' },
  ]

  const { Story } = defineMeta({
    title: 'Atoms/StatChip',
    component: StatChip,
    parameters: {
      docs: {
        description: {
          component:
            'A figure, a label, a tinted ground: the tone carries what the figure does not say (neutral, accent, watch, alert, good). The values shown here are the ones `kpis()` derives from the sample data set.',
        },
      },
    },
  })
</script>

<Story name="Gallery" asChild>
  <div class="stats">
    {#each INDICATORS as i (i.key)}
      <StatChip value={i.value} label={t(i.key, language)} tone={i.tone} />
    {/each}
  </div>
</Story>

<style>
  /* top row of the portfolio dashboard: 6 chips, 14 gutter */
  .stats {
    display: flex;
    gap: 14px;
    width: 1121px;
  }
</style>
