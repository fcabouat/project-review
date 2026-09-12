<script lang="ts">
  /**
   * The editing context's slide, rendered by SlideView in a responsive 16:9
   * frame. Mount only while open: deck position is derived on demand and
   * follows the current portfolio. Dialog owns focus, Escape and the overlay.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Slide } from '@project-review/core/projections/slide'
  import { deck, groupKey } from '@project-review/core/projections'
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
  let previewWidth = $state(0)
  const scale = $derived(previewWidth / SLIDE_WIDTH)

  const language = $derived(portfolio.settings.language)

  /** The current deck position, or absence when the slide is not emitted. */
  const position = $derived.by(() => {
    const slides = deck(portfolio)
    const index = slides.findIndex((s) => sameSlide(s, slide))
    return index < 0 ? undefined : { page: index + 1, total: slides.length }
  })

  function sameSlide(a: Slide, b: Slide): boolean {
    if (a.type !== b.type) return false
    if (a.type === 'sheet' && b.type === 'sheet') return a.projectId === b.projectId
    if (a.type === 'divider' && b.type === 'divider') return groupKey(a.group) === groupKey(b.group)
    if (a.type === 'freeform' && b.type === 'freeform') return a.slideId === b.slideId
    if ('page' in a && 'page' in b) return a.page === b.page
    return true
  }
</script>

<Dialog.Root open onOpenChange={(o) => o || close()}>
  <Dialog.Content
    class="top-11 max-h-[calc(100dvh-60px)] w-[860px] max-w-[calc(100%-32px)] translate-y-0 gap-0 overflow-x-hidden overflow-y-auto rounded-lg p-0 sm:max-w-[860px]"
    closeLabel={te('editor.io.close', language)}
  >
    <div
      class="border-border flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b py-3 pr-14 pl-[18px]"
    >
      <Dialog.Title class="min-w-0 wrap-anywhere text-sm font-bold"
        >{te('editor.preview.title', language, { subject })}</Dialog.Title
      >
      <span class="text-muted-foreground text-xs">
        {position
          ? te('editor.preview.position', language, position)
          : te('editor.preview.outOfDeck', language)}
      </span>
      <span class="ml-auto flex min-w-0 items-center gap-3.5">
        <!-- Opens the slideshow ON THIS slide: the deck position derived above is
             exactly the index the host starts on. Out-of-deck slide, or no shell
             around us: nothing to open. -->
        <Button
          variant="link"
          class="h-auto whitespace-normal p-0 text-[12.5px] font-bold"
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

    <div class="flex min-w-0 justify-center bg-[#2a2a31] p-[22px] max-sm:p-3">
      <div
        class="relative aspect-video w-full max-w-[793.6px] overflow-hidden rounded-[3px] bg-white shadow-[0_10px_34px_rgb(0_0_0/0.45)]"
        bind:clientWidth={previewWidth}
      >
        <div
          class="absolute top-0 left-0 origin-top-left"
          style="width:{SLIDE_WIDTH}px;height:{SLIDE_HEIGHT}px;transform:scale({scale})"
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
