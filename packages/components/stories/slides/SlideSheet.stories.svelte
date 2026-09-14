<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SlideSheet from '../../src/slides/SlideSheet.svelte'
  import RisksBand from '../../src/commons/RisksBand.svelte'
  import { language, project, sample } from '../commons/story-data'
  import { risksLevel } from '@project-review/core/projections'

  const { Story } = defineMeta({
    title: 'Slides/Sheet',
    component: SlideSheet,
    args: { portfolio: sample, total: 34 },
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'The reference template, a banded composition: goal band + merged facts block on row A, three narrative cards in strict thirds, risks and decision bands in equal halves, dated timeline. Three cases only — median, dense, minimal — because they are the ones that decide the layout; then the reference plate of the five tones of the risks band.',
        },
      },
    },
  })

  /* The five tones of the band, each read off a REAL project of the sample data
     set: confiance, vigilance, alerte, critique, then the neutral band whose
     project has no risks at all. */
  const tones = ['P-12', 'P-09', 'P-04', 'P-06', 'P-03'].map(project)
</script>

<!-- P-04, median case: the reference frame. -->
<Story name="P-04 — median" args={{ projectId: 'P-04', page: 12 }} />

<!-- P-09, dense case: 5 + 3 + 4 bullets, a 240-character goal, 6 milestones
     two of which are 12 days apart. It must hold without overflowing. -->
<Story name="P-09 — dense" args={{ projectId: 'P-09', page: 19 }} />

<!-- P-03, minimal case: actual end instead of target end, no sponsor, "RAS"
     risks and the neutral "no pending decision" band. It must breathe. -->
<Story name="P-03 — minimal" args={{ projectId: 'P-03', page: 10 }} />

<!-- Reference plate of the risks band (out of deck): the health level chooses
     the tone and the title; an empty text gives the neutral "RAS" band. -->
<Story name="RisksBandReference" asChild parameters={{ layout: 'padded' }}>
  <div class="plate">
    {#each tones as p (p.id)}
      <RisksBand level={risksLevel(p)} text={p.risks} {language} />
    {/each}
  </div>
</Story>

<style>
  /* two columns of a 1280 px frame, at the gutter of row C */
  .plate {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    max-width: 1280px;
    background: #fff;
  }
</style>
