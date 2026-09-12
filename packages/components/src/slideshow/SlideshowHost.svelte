<script lang="ts" module>
  import { getContext, setContext } from 'svelte'

  /**
   * Opening the slideshow from anywhere under the editor shell without threading
   * a callback through four intermediate views (`ReviewView`, `SheetView`,
   * `SettingsView`, `FreeSlideCard` all mount the slide preview). The shell
   * publishes the opener, the preview dialog asks for it; a component mounted
   * outside the shell — a story — gets `undefined` and keeps its button
   * disabled, which is exactly the wanted behaviour.
   */
  const OPENER = Symbol('slideshow.open')

  /** `index` is the 0-based deck position to start on. */
  export type SlideshowOpener = (index?: number) => void

  export function provideSlideshow(open: SlideshowOpener): void {
    setContext(OPENER, open)
  }

  export function useSlideshow(): SlideshowOpener | undefined {
    return getContext<SlideshowOpener | undefined>(OPENER)
  }
</script>

<script lang="ts">
  /**
   * Layer direction: the editor hosts the slideshow (editor → slideshow is the
   * only allowed dependency between the two); slideshow/ imports nothing from
   * editor/.
   *
   * Full-screen slideshow. Mounted ONLY on the generate button
   * (`editor.topbar.slideshow`) and
   * unmounted on the way back — reveal.js never exists while one edits
   * — reveal.js must never weigh on the editor's bundle. Two consequences
   * drive the whole file:
   *
   * 1. THE ENGINE IS IMPORTED AT MOUNT TIME. `await import('reveal.js')` and its
   *    base stylesheet (as a string, via `?inline`) are two dynamic chunks: the
   *    editor's bundle carries neither the code nor one byte of reveal CSS. No
   *    reveal THEME is loaded — `slides/theme.css` is our theme, and a reveal
   *    theme would fight it for every heading.
   * 2. THE STYLESHEET IS UNLOADED TOO. A dynamically imported `.css` file would
   *    stay injected in `<head>` forever; imported as a string and written into
   *    a `<style>` element WE own, it leaves with the component. After closing,
   *    the editor's DOM is byte-for-byte the one it had before.
   *
   * The deck is frozen at mount (`untrack`): the editor is covered and cannot
   * change while the show runs, and re-rendering sections under reveal's feet
   * would desynchronise its internal slide list.
   *
   * The stage is 1280 × 720 — the templates' own canvas — so reveal only ever
   * scales, never reflows a slide.
   */
  import { tick, untrack } from 'svelte'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { deckTree } from '@project-review/core/projections'
  import SlideView from '../slides/SlideView.svelte'
  import ExitBar, { type SaveState } from './ExitBar.svelte'
  import PrintView from './PrintView.svelte'
  import { te } from '../i18n'
  import { STANDALONE_REVEAL_OPTIONS } from './reveal-options'
  import './slideshow.css'

  type RevealDeck = InstanceType<typeof import('reveal.js').default>

  interface Props {
    readonly portfolio: Portfolio
    /** 0-based deck position to open on (`editor.preview.openSlideshow`). */
    readonly startAt?: number
    /** Back to the editor: the caller unmounts this component. */
    readonly close: () => void
    /**
     * The save action (`editor.slideshow.save`) — the standalone .html. Injected by the app shell
     * (infrastructure/slideshow-export.ts); layering forbids the reverse
     * import. Absent — a story — the button is a no-op.
     */
    readonly exportStandalone?: (slidesEl: HTMLElement, portfolio: Portfolio) => Promise<void>
  }

  let { portfolio, startAt = 0, close, exportStandalone }: Props = $props()

  /** Slide canvas, fixed by the slide templates. */
  const SLIDE_WIDTH = 1280
  const SLIDE_HEIGHT = 720

  /**
   * The slideshow drawers: → skips a whole category, ↓ opens its sheets.
   * `groups` drives the markup, `slides` (its exact flattening — the `deckTree`
   * invariant) keeps the flat page numbers.
   */
  const groups = untrack(() => deckTree(portfolio))
  const slides = groups.flatMap((g) => (g.kind === 'single' ? [g.slide] : [...g.slides]))
  /** Flat index of the first slide of each group — page numbering. */
  const offsets = groups.reduce<number[]>((acc, g, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1]! + sizeOf(i - 1))
    return acc
  }, [])
  const language = $derived(portfolio.settings.language)

  function sizeOf(groupIndex: number): number {
    const g = groups[groupIndex]
    return g === undefined ? 1 : g.kind === 'single' ? 1 : g.slides.length
  }

  /** reveal position (horizontal group, vertical slide within its drawer). */
  interface GridPosition {
    readonly h: number
    readonly v: number
  }

  function toGrid(flatIndex: number): GridPosition {
    let remaining = Math.min(Math.max(flatIndex, 0), Math.max(slides.length - 1, 0))
    for (let h = 0; h < groups.length; h += 1) {
      const size = sizeOf(h)
      if (remaining < size) return { h, v: remaining }
      remaining -= size
    }
    return { h: 0, v: 0 }
  }

  let stage = $state<HTMLDivElement | undefined>()
  /**
   * WHERE THE BOOT STANDS — three states, and the third is the one that was
   * missing. Loading the engine is two dynamic imports and an `initialize()`
   * over the network of a single-file deliverable: an offline reload, a
   * blocked chunk or an engine that throws are all real. Left uncaught, the
   * promise rejected in silence and the « loading » line stayed on screen for
   * ever — a spinner that means "broken" is the worst thing an interface can
   * say, because it says nothing at all. `failed` says it and offers the one
   * move that can help: try again.
   */
  let phase = $state<'booting' | 'ready' | 'failed'>('booting')
  /** Bumped by « try again » — the boot effect reads it, so a new attempt is
   * an ordinary re-run (teardown included) rather than a second code path. */
  let attempt = $state(0)
  /** Where the standalone export stands — see {@link ExitBar}'s `saveState`. */
  let saveState = $state<SaveState>('idle')
  let printing = $state(false)

  let revealDeck: RevealDeck | undefined
  let styleEl: HTMLStyleElement | undefined
  let unhide: MutationObserver | undefined
  /** Where to come back to after a print detour. Also the initial position. */
  let position = untrack(() => toGrid(startAt))

  /**
   * Boot and teardown are tied to the STAGE ELEMENT, not to the component: going
   * to print mode swaps the stage away, which must destroy reveal, and coming
   * back must build it again. The effect reads `stage` and nothing else — the
   * asynchronous part runs outside the tracking window on purpose.
   */
  /** What the effect below boots: the stage, and WHICH attempt this is. A new
   * object on either change is what makes « try again » an ordinary re-run of
   * the one boot path — teardown included — rather than a second one. */
  const target = $derived(stage === undefined ? undefined : { el: stage, attempt })

  $effect(() => {
    const current = target
    if (current === undefined) return
    let cancelled = false
    phase = 'booting'
    void boot(current.el, () => cancelled).catch(() => {
      // A cancelled boot is not a failed one: the component (or the print
      // detour) took the stage away, and there is nobody left to tell.
      if (!cancelled) phase = 'failed'
    })
    return () => {
      cancelled = true
      teardown()
    }
  })

  function retry(): void {
    attempt += 1
  }

  async function boot(el: HTMLElement, isCancelled: () => boolean): Promise<void> {
    const [engine, base] = await Promise.all([
      import('reveal.js'),
      import('reveal.js/reveal.css?inline'),
    ])
    if (isCancelled()) return

    styleEl = document.createElement('style')
    styleEl.dataset.owner = 'slideshow'
    styleEl.textContent = base.default
    document.head.appendChild(styleEl)

    // One option set for the live host AND the standalone export (see the
    // TSDoc on `STANDALONE_REVEAL_OPTIONS`): the spread keeps them from
    // drifting apart; the canvas is pinned explicitly as the host's only say.
    // Motion preference: reveal animates slides with inline transforms the
    // global reduced-motion CSS rule cannot reach — ask for no transition
    // outright (the standalone export's boot script does the same check).
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const instance = new engine.default(el, {
      ...STANDALONE_REVEAL_OPTIONS,
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      ...(still ? { transition: 'none' as const, backgroundTransition: 'none' as const } : {}),
    })

    await instance.initialize()
    if (isCancelled()) {
      instance.destroy()
      return
    }

    revealDeck = instance
    instance.on('slidechanged', onSlideChanged)

    // Tailwind's preflight carries `[hidden] { display: none !important }` in
    // `@layer base`, which no unlayered rule and no inline style can outrank —
    // and reveal puts `hidden` on every non-present section while DRIVING their
    // display through inline styles (transitions show them at opacity 0, the
    // overview shows them all). Dropping the boolean attribute — reveal keeps
    // `aria-hidden` for assistive tech — restores stock reveal behaviour; the
    // observer drops it again each time reveal's updateSlides() puts it back.
    const slidesEl = el.querySelector('.slides')
    if (slidesEl) {
      const strip = (): void => {
        for (const s of slidesEl.querySelectorAll('section[hidden]')) s.removeAttribute('hidden')
      }
      strip()
      unhide = new MutationObserver(strip)
      unhide.observe(slidesEl, { attributes: true, attributeFilter: ['hidden'], subtree: true })
    }

    if (position.h > 0 || position.v > 0) instance.slide(position.h, position.v)
    phase = 'ready'
  }

  function onSlideChanged(): void {
    const indices = revealDeck?.getIndices()
    if (indices) position = { h: indices.h, v: indices.v ?? 0 }
  }

  function teardown(): void {
    phase = 'booting'
    unhide?.disconnect()
    unhide = undefined
    if (revealDeck) {
      revealDeck.off('slidechanged', onSlideChanged)
      revealDeck.destroy()
      revealDeck = undefined
    }
    styleEl?.remove()
    styleEl = undefined
    // reveal.js decorates the page itself when `embedded` is false; it removes
    // its own classes on destroy, but the stage must not depend on that.
    document.documentElement.classList.remove('reveal-full-page')
    document.body.classList.remove('reveal-viewport')
    document.documentElement.style.removeProperty('--vh')
  }

  /**
   * Print: reveal is dismissed (the `{#if}` unmounts the stage, the effect's
   * cleanup destroys the engine and unloads its stylesheet), the flat deck is
   * rendered instead, and Chrome is asked for the dialog only once the browser
   * has actually laid out the 34 pages — hence the double frame.
   */
  async function print(): Promise<void> {
    if (printing) return
    printing = true
    document.documentElement.classList.add('rp-printing')
    await tick()
    await twoFrames()

    const restore = (): void => {
      window.removeEventListener('afterprint', restore)
      clearTimeout(guard)
      document.documentElement.classList.remove('rp-printing')
      printing = false
    }
    window.addEventListener('afterprint', restore)
    // Some environments never fire `afterprint`; the show must come back anyway.
    const guard = setTimeout(restore, 2000)
    window.print()
  }

  function twoFrames(): Promise<void> {
    return new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  }

  function toggleOverview(): void {
    revealDeck?.toggleOverview()
  }

  /**
   * « Enregistrer » — delegated to the injected export (the harvesting needs
   * the RENDERED sections, which only this host holds).
   */
  /** Cleared after a success so the bar goes back to offering the action
   * rather than reporting the last one for ever. */
  const DONE_MS = 2500

  async function save(): Promise<void> {
    // A second click while the file is being built would harvest the same DOM
    // twice and hand the browser two downloads.
    if (saveState === 'saving') return
    const slidesEl = stage?.querySelector('.slides')
    if (!exportStandalone || !(slidesEl instanceof HTMLElement)) {
      // No export wired (a story) or no rendered deck to harvest: there is
      // nothing to try again, and saying « failed » would invite a retry that
      // cannot work.
      return
    }
    saveState = 'saving'
    try {
      await exportStandalone(slidesEl, portfolio)
      saveState = 'done'
      setTimeout(() => {
        if (saveState === 'done') saveState = 'idle'
      }, DONE_MS)
    } catch {
      // The reason is a browser one (a refused download, an engine source that
      // would not load, a document too large to inline) and none of it is
      // actionable prose. What IS actionable is the retry, and the bar labels
      // it on the very button that failed.
      saveState = 'error'
    }
  }

  /**
   * Escape only matters here during the print detour: it brings the show back.
   * While the show runs, Escape is reveal's (overview toggle) and the show is
   * closed from the exit bar alone.
   */
  function onkeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !printing) return
    event.preventDefault()
    document.documentElement.classList.remove('rp-printing')
    printing = false
  }
</script>

<svelte:window {onkeydown} />

{#if printing}
  <PrintView {portfolio} />
{:else}
  <div class="rp-stage" role="region" aria-label={te('editor.slideshow.aria', language)}>
    <div class="reveal" bind:this={stage}>
      <div class="slides">
        <!-- A slide template's root already IS a `<section class="slide">`, so a
             lone `SlideView` lands directly as one reveal slide — never wrap a
             SINGLE in anything. The `<section class="stack">` wrapper is the one
             deliberate exception: reveal treats a section containing sections as
             a vertical STACK (it adds the class itself; written out so the CSS
             holds before boot), which is exactly the drawer navigation the
             deck tree describes. Page numbers stay FLAT across the drawers. -->
        {#each groups as group, h (h)}
          {#if group.kind === 'stack'}
            <section class="stack">
              {#each group.slides as slide, v (v)}
                <SlideView {portfolio} {slide} page={offsets[h]! + v + 1} total={slides.length} />
              {/each}
            </section>
          {:else}
            <SlideView
              {portfolio}
              slide={group.slide}
              page={offsets[h]! + 1}
              total={slides.length}
            />
          {/if}
        {/each}
      </div>
    </div>

    {#if phase === 'failed'}
      <div class="rp-loading rp-failed" role="alert">
        <p>{te('editor.slideshow.bootFailed', language)}</p>
        <button class="rp-retry" type="button" onclick={retry}>
          {te('editor.slideshow.retry', language)}
        </button>
      </div>
    {:else if phase === 'booting'}
      <p class="rp-loading">{te('editor.slideshow.loading', language)}</p>
    {/if}

    <ExitBar
      {language}
      back={close}
      overview={toggleOverview}
      save={() => void save()}
      {saveState}
      {print}
      {close}
    />
  </div>
{/if}
