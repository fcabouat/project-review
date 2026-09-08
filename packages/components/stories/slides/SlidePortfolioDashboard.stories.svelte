<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SlidePortfolioDashboard from '../../src/slides/SlidePortfolioDashboard.svelte'
  import { sample } from '../commons/story-data'

  const { Story } = defineMeta({
    title: 'Slides/PortfolioDashboard',
    component: SlidePortfolioDashboard,
    args: { portfolio: sample, page: 3, total: 34 },
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'D1: the six derived indicators, then one bar per non-empty category (8 of them here). The bar scale is shared by every row — 4 projects = 489 px — otherwise comparing two categories would mean nothing.',
        },
      },
    },
  })
</script>

<Story name="The portfolio" />
