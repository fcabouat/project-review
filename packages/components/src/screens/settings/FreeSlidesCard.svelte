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

<section class="card">
  <h2>{te('editor.settings.freeSlides', language)}</h2>
  {#each freeSlides as slide (slide.id)}
    <FreeSlideCard {portfolio} {dispatch} {slide} />
  {:else}
    <p class="hint">{te('editor.review.noFreeSlide', language)}</p>
  {/each}
</section>
