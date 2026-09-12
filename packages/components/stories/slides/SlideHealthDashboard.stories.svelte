<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SlideHealthDashboard from '../../src/slides/SlideHealthDashboard.svelte'
  import { sample } from '../commons/story-data'

  const { Story } = defineMeta({
    title: 'Slides/HealthDashboard',
    component: SlideHealthDashboard,
    args: { portfolio: sample, page: 4, total: 34 },
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'The health dashboard: health breakdown (8 / 5 / 1 / 1 / 2) with the overdue-milestone inset stuck to it, then the 7 pending decisions. Alert borders on P-04 (alert) and P-06 (critical).',
        },
      },
    },
  })
</script>

<Story name="For today's session" />
