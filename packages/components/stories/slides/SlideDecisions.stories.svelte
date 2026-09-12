<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SlideDecisions from '../../src/slides/SlideDecisions.svelte'
  import { sample } from '../commons/story-data'
  import { decisionPages } from '@project-review/core/projections'

  // Real pagination: a single page of 7 decisions — so no page mention.
  const pages = decisionPages(sample)

  const { Story } = defineMeta({
    title: 'Slides/Decisions',
    component: SlideDecisions,
    args: { portfolio: sample, page: 32, total: 34 },
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Today\'s table, calibrated for handwriting (21 · 30 · 11 · 26 · 12 %): the two right-hand columns are 52 px writing zones. A single page here, so the "page i / n" mention stays hidden.',
        },
      },
    },
  })
</script>

<!-- Full page: the 7 pending decisions of the sample data set. -->
<Story
  name="Full page — 7 rows"
  args={{ entries: pages[0] ?? [], pageNumber: 1, totalPages: pages.length }}
/>
