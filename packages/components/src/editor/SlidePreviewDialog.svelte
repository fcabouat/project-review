<script lang="ts">
  /**
   * E2ter — preview of THE slide bound to the editing context: the sheet of the
   * project being edited, the divider of a category, the title slide, a free
   * slide. One slide, rendered by the real `SlideView` — no second rendering
   * path, so what the preview shows is what the deck will show.
   *
   * MOUNT SEMANTICS, imposed by the canon's own footnote: the render is computed
   * WHEN THE MODAL OPENS and keeps recomputing WHILE IT IS DISPLAYED (plain
   * reactivity). The caller must therefore mount this component only while the
   * preview is open — `{#if}`, never `hidden` — so an unmounted dialog renders
   * exactly zero slides in the background. That is also why the deck position is
   * derived here rather than passed in: it costs nothing while open, and nothing
   * at all while closed.
   *
   * The slide is 1280 × 720 by contract; the stage shows it at `SCALE` inside a
   * 16:9 frame, on the dark ground of the mockup.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Slide } from '@project-review/core/model/slide'
  import { deck } from '@project-review/core/projections'
  import SlideView from '../slides/SlideView.svelte'
  import { autofocus } from './autofocus'
  import { te } from '../i18n'
  import { useSlideshow } from '../slideshow/SlideshowHost.svelte'

  /**
   * Published by the editor shell. `undefined` outside it (a story), in which
   * case the button stays disabled rather than pretending — a story must never
   * be able to mount reveal.js (pitfall n° 12).
   */
  const openSlideshow = useSlideshow()

  interface Props {
    readonly portfolio: Portfolio
    /** The slide to render — already the one the context is editing. */
    readonly slide: Slide
    /** Subject line of the header, e.g. "P-04 · Fiche projet". */
    readonly subject: string
    readonly close: () => void
  }

  let { portfolio, slide, subject, close }: Props = $props()

  /** Slide canvas, fixed by the templates (plan § 5). */
  const SLIDE_WIDTH = 1280
  const SLIDE_HEIGHT = 720
  const SCALE = 0.62

  const language = $derived(portfolio.settings.language)

  /**
   * Position in the deck: the same `deck()` every other counter uses, so the
   * preview cannot drift from the slideshow. `undefined` for a slide the current
   * settings do not emit (an "always" sheet in a hidden category, a free slide
   * whose anchor no longer resolves) — the header then says so instead of lying
   * about a page number.
   */
  const position = $derived.by(() => {
    const slides = deck(portfolio)
    const index = slides.findIndex((s) => sameSlide(s, slide))
    return index < 0 ? undefined : { page: index + 1, total: slides.length }
  })

  function sameSlide(a: Slide, b: Slide): boolean {
    if (a.type !== b.type) return false
    if (a.type === 'sheet' && b.type === 'sheet') return a.projectId === b.projectId
    if (a.type === 'divider' && b.type === 'divider') return a.categoryId === b.categoryId
    if (a.type === 'freeform' && b.type === 'freeform') return a.slideId === b.slideId
    return true
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') close()
  }}
/>

<div
  class="modal-overlay"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) close()
  }}
>
  <!-- Focused on mount: an aria-modal dialog must receive focus when it opens. -->
  <div
    class="modal modal--apercu"
    role="dialog"
    aria-modal="true"
    aria-label={subject}
    tabindex="-1"
    use:autofocus
  >
    <div class="apercu-head">
      <b>{te('editor.preview.title', language, { subject })}</b>
      <span class="apercu-pos">
        {position
          ? te('editor.preview.position', language, position)
          : te('editor.preview.outOfDeck', language)}
      </span>
      <span class="apercu-actions">
        <!-- Opens the slideshow ON THIS slide: the deck position derived above is
             exactly the index the host starts on. Out-of-deck slide, or no shell
             around us: nothing to open. -->
        <button
          class="link-btn"
          type="button"
          disabled={!openSlideshow || !position}
          title={te('editor.topbar.openSlideshow', language)}
          onclick={() => {
            if (!openSlideshow || !position) return
            close()
            openSlideshow(position.page - 1)
          }}
        >
          {te('editor.preview.openSlideshow', language)}
        </button>
        <button
          class="apercu-close"
          type="button"
          title={te('editor.io.close', language)}
          aria-label={te('editor.io.close', language)}
          onclick={close}>✕</button
        >
      </span>
    </div>

    <div class="apercu-stage">
      <div
        class="apercu-frame"
        style="width:{SLIDE_WIDTH * SCALE}px;height:{SLIDE_HEIGHT * SCALE}px"
      >
        <div
          class="apercu-scale"
          style="width:{SLIDE_WIDTH}px;height:{SLIDE_HEIGHT}px;transform:scale({SCALE})"
        >
          <SlideView {portfolio} {slide} page={position?.page} total={position?.total} />
        </div>
      </div>
    </div>

    <p class="apercu-foot">{te('editor.preview.foot', language)}</p>
  </div>
</div>
