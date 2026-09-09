<script lang="ts">
  /** Free-slides card: the list of free slides, one editable row per slide. */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { te } from '../../i18n'
  import FreeSlideCard from '../../editor/FreeSlideCard.svelte'
  import type { Dispatch } from '../contracts'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
  }

  let { portfolio, dispatch }: Props = $props()

  const language = $derived(portfolio.settings.language)
  const freeSlides = $derived(portfolio.freeSlides)
</script>

<section class="bg-background border-border rounded-lg border p-4">
  <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
    {te('editor.settings.freeSlides', language)}
  </h2>
  {#each freeSlides as slide (slide.id)}
    <FreeSlideCard {portfolio} {dispatch} {slide} />
  {:else}
    <p class="text-muted-foreground text-[11.5px]">{te('editor.review.noFreeSlide', language)}</p>
  {/each}
</section>
