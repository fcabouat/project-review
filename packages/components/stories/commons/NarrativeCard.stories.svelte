<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import NarrativeCard from '../../src/commons/NarrativeCard.svelte'
  import { language, project } from './story-data'

  // P-09, the dense case of the model: 5 + 3 + 4 complete bullets.
  const p9 = project('P-09')

  const { Story } = defineMeta({
    title: 'Atoms/NarrativeCard',
    component: NarrativeCard,
    args: { language },
    parameters: {
      docs: {
        description: {
          component:
            'The three columns of the review narrative (band 2 of the sheet). The disc color tells the tense of the verb: green for what is done, blue for the present, light blue for what is coming.',
        },
      },
    },
  })
</script>

<!-- Gallery: the three variants side by side, inner hairlines as on the sheet. -->
<Story name="Gallery" asChild>
  <div class="b2">
    <div class="col"><NarrativeCard variant="done" lines={p9.done} {language} /></div>
    <div class="col"><NarrativeCard variant="ongoing" lines={p9.ongoing} {language} /></div>
    <div class="col">
      <NarrativeCard variant="next" lines={p9.next} {language} />
    </div>
  </div>
</Story>

<style>
  /* band 2 dimensions: 1.24 / 0.88 / 0.88, inner hairline, white card */
  .b2 {
    width: 1120px;
    border: 1px solid var(--border2);
    border-radius: 8px;
    background: #fff;
    display: grid;
    grid-template-columns: 1.24fr 0.88fr 0.88fr;
    overflow: hidden;
  }
  .col {
    padding: 10px 14px;
    border-left: 1px solid var(--border2);
    min-width: 0;
  }
  .col:first-child {
    border-left: 0;
  }
</style>
