<script lang="ts">
  /**
   * Print mode: the deck laid FLAT — the 34 slides one after another, in the
   * order `deck()` emits them, with no reveal.js anywhere. `print.css` (loaded
   * by the slide templates themselves) transposes each `.slide` to 1122 × 793 px
   * and puts a `break-after: page` on it; Chrome's own preview then produces one
   * A4 landscape page per slide.
   *
   * The page-size rule lives in `print.css`, not here: 1122 × 793 and NOT 1123 × 794,
   * one pixel under the 96 dpi A4, otherwise Chrome slips a blank page between
   * two slides. Nothing in this component may add height to a slide — hence the
   * flat container with zero gap and zero padding in print, and a plain stack on
   * screen so `?print` is also readable before printing.
   *
   * Two entry points, one component: `?print` in the URL (App mounts it instead
   * of the editor) and the exit bar's Print button (`SlideshowHost` swaps reveal
   * for this view, then calls `window.print()`). In the second case the editor is
   * still mounted underneath, which is what `slideshow.css` hides behind the
   * `rp-printing` class on `<html>`.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { deck } from '@project-review/core/projections'
  import SlideView from '../slides/SlideView.svelte'
  import { te } from '../i18n'
  import './slideshow.css'

  interface Props {
    readonly portfolio: Portfolio
  }

  let { portfolio }: Props = $props()

  const slides = $derived(deck(portfolio))
  const language = $derived(portfolio.settings.language)
</script>

<div
  class="rp-print-root"
  aria-label={te('editor.slideshow.printAria', language, { n: slides.length })}
>
  {#each slides as slide, i (i)}
    <SlideView {portfolio} {slide} page={i + 1} total={slides.length} />
  {/each}
</div>
