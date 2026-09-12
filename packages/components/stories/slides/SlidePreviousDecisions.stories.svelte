<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SlidePreviousDecisions from '../../src/slides/SlidePreviousDecisions.svelte'
  import { sample } from '../commons/story-data'

  const { Story } = defineMeta({
    title: 'Slides/PreviousDecisions',
    component: SlidePreviousDecisions,
    args: { portfolio: sample, page: 34, total: 34 },
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Accountability appendix, entirely derived: the decisions settled since the previous review (P-01 and P-13). Nothing to fill in — hence the airy rows and no writing zone.',
        },
      },
    },
  })
</script>

<Story name="Record of the previous review" />
