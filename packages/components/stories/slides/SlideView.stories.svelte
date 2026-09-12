<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import SlideView from '../../src/slides/SlideView.svelte'
  import { sample } from '../commons/story-data'
  import { deck } from '@project-review/core/projections'

  /* The whole deck of the sample data set: 34 slides, in the order `deck()`
     emits them. This is the global visual control — nothing here is staged. */
  const slides = deck(sample)

  const { Story } = defineMeta({
    title: 'Slides/Deck',
    component: SlideView,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'The dispatcher applied to `deck(sample)`: 34 slides rendered as a scrolling list. Every slide type in its real position, at 1:1 scale.',
        },
      },
    },
  })
</script>

<!-- Whole deck, scrollable: the only view where a break in rhythm shows. -->
<Story name="Whole deck" asChild>
  <div class="deck">
    {#each slides as slide, i (i)}
      <SlideView portfolio={sample} {slide} page={i + 1} total={slides.length} />
    {/each}
  </div>
</Story>

<style>
  .deck {
    display: flex;
    flex-direction: column;
    gap: 44px;
    padding: 44px 27px;
    background: #ececee;
  }
</style>
