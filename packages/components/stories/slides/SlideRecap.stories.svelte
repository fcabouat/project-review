<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SlideRecap from '../../src/slides/SlideRecap.svelte'
  import { sample } from '../commons/story-data'
  import { recapPages } from '@project-review/core/projections'

  // Real pagination of the sample data set: [11, 6] rows.
  const pages = recapPages(sample)

  const { Story } = defineMeta({
    title: 'Slides/Recap',
    component: SlideRecap,
    args: { portfolio: sample, page: 5, total: 34 },
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Recap paginated by `recapRows` (11 here): one row per tracked project. The overdue milestone of P-06 turns red; the "Decision" column ticks the projects with a pending decision.',
        },
      },
    },
  })
</script>

<Story
  name="Page 1 of 2"
  args={{
    projectIds: (pages[0] ?? []).map((p) => p.id),
    pageNumber: 1,
    totalPages: pages.length,
  }}
/>
