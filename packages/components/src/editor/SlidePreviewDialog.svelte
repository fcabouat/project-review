<script lang="ts">
  /**
   * Slide preview dialog — preview of THE slide bound to the editing context:
   * the sheet of the project being edited, the divider of a category, the title
   * slide, a free slide. One slide, rendered by the real `SlideView` — no
   * second rendering path, so what the preview shows is what the deck will
   * show.
   *
   * MOUNT SEMANTICS: the render is computed WHEN THE MODAL OPENS and keeps
   * recomputing WHILE IT IS DISPLAYED (plain reactivity). The caller must
   * therefore mount this component only while the preview is open — `{#if}`,
   * never `hidden` — so an unmounted dialog renders exactly zero slides in the
   * background. That is also why the deck position is derived here rather than
   * passed in: it costs nothing while open, and nothing at all while closed.
   *
   * The slide is 1280 × 720 by contract; the stage shows it at `SCALE` inside a
   * 16:9 frame, on a dark ground. The vendored Dialog owns the overlay, the
   * focus trap and Escape.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Slide } from '@project-review/core/projections/slide'
  import { deck } from '@project-review/core/projections'
  import SlideView from '../slides/SlideView.svelte'
  import { te } from '../i18n'
  import { Button } from '../commons/ui/button'
  import * as Dialog from '../commons/ui/dialog'
  import { useSlideshow } from '../slideshow/SlideshowHost.svelte'

  /**
   * Published by the editor shell. `undefined` outside it (a story), in which
   * case the button stays disabled rather than pretending — a story must never
   * be able to mount reveal.js.
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

  /** Slide canvas, fixed by the slide templates. */
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

<Dialog.Root open onOpenChange={(o) => o || close()}>
  <Dialog.Content
    class="top-11 w-[860px] max-w-[calc(100%-32px)] translate-y-0 gap-0 overflow-hidden rounded-lg p-0 sm:max-w-[860px]"
  >
    <div class="border-border flex items-center gap-3 border-b py-3 pr-14 pl-[18px]">
      <Dialog.Title class="text-sm font-bold"
        >{te('editor.preview.title', language, { subject })}</Dialog.Title
      >
      <span class="text-muted-foreground text-xs">
        {position
          ? te('editor.preview.position', language, position)
          : te('editor.preview.outOfDeck', language)}
      </span>
      <span class="ml-auto flex items-center gap-3.5">
        <!-- Opens the slideshow ON THIS slide: the deck position derived above is
             exactly the index the host starts on. Out-of-deck slide, or no shell
             around us: nothing to open. -->
        <Button
          variant="link"
          class="h-auto p-0 text-[12.5px] font-bold"
          disabled={!openSlideshow || !position}
          title={te('editor.topbar.openSlideshow', language)}
          onclick={() => {
            if (!openSlideshow || !position) return
            close()
            openSlideshow(position.page - 1)
          }}
        >
          {te('editor.preview.openSlideshow', language)}
        </Button>
      </span>
    </div>

    <div class="flex justify-center bg-[#2a2a31] p-[22px]">
      <div
        class="relative flex-none overflow-hidden rounded-[3px] bg-white shadow-[0_10px_34px_rgb(0_0_0/0.45)]"
        style="width:{SLIDE_WIDTH * SCALE}px;height:{SLIDE_HEIGHT * SCALE}px"
      >
        <div
          class="absolute top-0 left-0 origin-top-left"
          style="width:{SLIDE_WIDTH}px;height:{SLIDE_HEIGHT}px;transform:scale({SCALE})"
        >
          <SlideView {portfolio} {slide} page={position?.page} total={position?.total} />
        </div>
      </div>
    </div>

    <Dialog.Description
      class="border-border text-muted-foreground border-t px-[18px] py-2.5 text-[11.5px]"
    >
      {te('editor.preview.foot', language)}
    </Dialog.Description>
  </Dialog.Content>
</Dialog.Root>
