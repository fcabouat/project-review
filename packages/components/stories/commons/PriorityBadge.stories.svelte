<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import PriorityBadge from '../../src/commons/PriorityBadge.svelte'
  import { language } from './story-data'
  import { PRIORITIES } from '@project-review/core/model/project'

  const { Story } = defineMeta({
    title: 'Atoms/PriorityBadge',
    component: PriorityBadge,
    args: { language },
    parameters: {
      docs: {
        description: {
          component:
            'P1 / P2 / P3, or "—" when the priority is not filled in: the sheet banner keeps its metrics, never an empty cell.',
        },
      },
    },
  })
</script>

<Story name="Gallery" asChild>
  <div class="row">
    {#each PRIORITIES as p (p)}
      <PriorityBadge priority={p} {language} />
    {/each}
    <PriorityBadge {language} />
  </div>
</Story>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
</style>
