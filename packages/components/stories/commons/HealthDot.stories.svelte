<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import HealthDot from '../../src/commons/HealthDot.svelte'
  import { language } from './story-data'
  import { HEALTH_LEVELS } from '@project-review/core/model/project'

  const { Story } = defineMeta({
    title: 'Atoms/HealthDot',
    component: HealthDot,
    args: { language },
    parameters: {
      docs: {
        description: {
          component:
            'The five states side by side: four levels plus "not assessed", which is a state of its own and not a void. "text" shape in the recap table, "chip" shape in the sheet banner.',
        },
      },
    },
  })
</script>

<!-- Gallery: the 5 states, in both shapes — it is the comparison that informs. -->
<Story name="Gallery" asChild>
  <div class="rows">
    <div class="row">
      {#each HEALTH_LEVELS as level (level)}
        <HealthDot health={level} {language} />
      {/each}
      <HealthDot {language} />
    </div>
    <div class="row">
      {#each HEALTH_LEVELS as level (level)}
        <HealthDot health={level} {language} shape="chip" />
      {/each}
      <HealthDot {language} shape="chip" />
    </div>
  </div>
</Story>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    gap: 17px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 17px;
    flex-wrap: wrap;
  }
</style>
