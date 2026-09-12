<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import FactsBlock from '../../src/commons/FactsBlock.svelte'
  import { language, project } from './story-data'

  const { Story } = defineMeta({
    title: 'Atoms/FactsBlock',
    component: FactsBlock,
    args: { language },
    parameters: {
      docs: {
        description: {
          component:
            'The merged facts block of the sheet’s row A, at its reference width (338 px in 16:9). Three columns separated by hairlines — start, end, progress as the BAR ALONE — then the budget across the full width under a rule. The block is sized by its content; the row caps it at 104 px. Values come from the sample data set.',
        },
      },
    },
  })

  const p04 = project('P-04')
  const p03 = project('P-03')
  /** A project still to be framed: no dates, no progress, no budget yet. */
  const p08 = project('P-08')
</script>

<!-- P-04, the reference case: start, target end, progress at 35 %, budget on 1 line. -->
<Story name="Reference block" asChild>
  <div class="row"><FactsBlock project={p04} {language} /></div>
</Story>

<!-- P-03, done with residuals: ACTUAL end instead of target end, full bar. -->
<Story name="Actual end" asChild>
  <div class="row"><FactsBlock project={p03} {language} /></div>
</Story>

<!-- Not assessed: the em dash of the catalog for the missing values, and the
     fully grey track — never a red bar at 0 %. -->
<Story name="Not assessed" asChild>
  <div class="row"><FactsBlock project={p08} {language} /></div>
</Story>

<style>
  /* the width row A gives the block on the 16:9 frame */
  .row {
    width: 338px;
    background: #fff;
  }
</style>
