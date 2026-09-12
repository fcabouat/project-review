<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SlideTitle from '../../src/slides/SlideTitle.svelte'
  import { sample } from '../commons/story-data'

  const { Story } = defineMeta({
    title: 'Slides/Title',
    component: SlideTitle,
    args: { portfolio: sample },
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Cover: white column 489 + blue block 791. The four KPIs are derived from the sample data set (17 / 11 / 2 / 7); the low signature carries the long directorate and service, with the contact box as a sub-line.',
        },
      },
    },
  })
</script>

<Story name="Title" />
