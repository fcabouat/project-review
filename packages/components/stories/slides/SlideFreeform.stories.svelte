<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SlideFreeform from '../../src/slides/SlideFreeform.svelte'
  import { sample } from '../commons/story-data'

  const { Story } = defineMeta({
    title: 'Slides/Freeform',
    component: SlideFreeform,
    args: { portfolio: sample, page: 2, total: 34 },
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Free slide anchored on the opening ("Actualités du service"): the entered title, then the bullets in the micro-format — bold and dimmed "— precision" suffix — read at arm\'s length.',
        },
      },
    },
  })
</script>

<Story name="Opening" args={{ slideId: 'sl-01' }} />
