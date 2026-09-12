<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SlideArchives from '../../src/slides/SlideArchives.svelte'
  import { sample } from '../commons/story-data'

  const { Story } = defineMeta({
    title: 'Slides/Archives',
    component: SlideArchives,
    args: { portfolio: sample, page: 33, total: 34 },
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Closed and abandoned projects (P-14, P-15, P-16): they leave the tracking but stay readable. The closing note is what the project last achieved — or, for an abandoned one, why it was dropped.',
        },
      },
    },
  })
</script>

<Story name="Archived projects" />
