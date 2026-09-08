<script lang="ts">
  /**
   * E4 exit bar, copied from the canonical mockup `mockups/editeur.html`
   * (`.ss-exitbar`): a dark translucent overlay pinned to the top edge, invisible
   * until the pointer reaches the top ~60 px of the stage — or until a keyboard
   * user focuses one of its buttons.
   *
   * The reveal zone is a separate 60 px strip that is ALWAYS present and always
   * transparent: hovering the bar itself would be a chicken-and-egg problem once
   * it is hidden, and `pointer-events` games on a 48 px bar leave the corners
   * dead. The strip owns the hover, the bar owns the paint.
   *
   * No knowledge of reveal: callbacks in, buttons out. The one piece of state
   * it owns is the FULLSCREEN flag, because fullscreen is a document affair,
   * not a reveal one — tracked on `fullscreenchange` so the label follows
   * reality whatever toggled it (F11 aside: that is browser chrome, invisible
   * to the API). That is what keeps it storybook-able while `SlideshowHost`
   * is not (pitfall n° 12).
   */
  import type { Language } from '@project-review/core/model/theme'
  import { te } from '../i18n'

  interface Props {
    readonly language: Language
    /** Back to the editor — same effect as the ✕. */
    readonly back: () => void
    /** Reveal's overview toggle — the host owns the deck instance. */
    readonly overview: () => void
    /** Standalone .html download. */
    readonly save: () => void
    readonly print: () => void
    readonly close: () => void
    /** Stories force the bar open; the application never does. */
    readonly pinned?: boolean
  }

  let { language, back, overview, save, print, close, pinned = false }: Props = $props()

  // Focus inside the bar keeps it visible for keyboard users (the hover CSS
  // alone would flash it away as soon as the mouse leaves).
  let focused = $state(false)

  let fullscreen = $state(false)

  $effect(() => {
    const sync = (): void => {
      fullscreen = document.fullscreenElement !== null
    }
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  })

  function toggleFullscreen(): void {
    if (document.fullscreenElement !== null) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  }
</script>

<div class="exit-zone" class:pinned>
  <div
    class="exit-bar"
    class:focused
    role="toolbar"
    aria-label={te('editor.slideshow.bar', language)}
    onfocusin={() => (focused = true)}
    onfocusout={() => (focused = false)}
  >
    <button class="exit-btn exit-left" type="button" onclick={back}>
      {te('editor.slideshow.back', language)}
    </button>
    <span class="exit-right">
      <button class="exit-btn" type="button" onclick={overview}>
        {te('editor.slideshow.overview', language)}
      </button>
      <button class="exit-btn" type="button" onclick={toggleFullscreen}>
        {te(
          fullscreen ? 'editor.slideshow.fullscreenExit' : 'editor.slideshow.fullscreen',
          language,
        )}
      </button>
      <button class="exit-btn" type="button" onclick={save}>
        {te('editor.slideshow.save', language)}
      </button>
      <button class="exit-btn" type="button" onclick={print}>
        {te('editor.slideshow.print', language)}
      </button>
      <button class="exit-btn" type="button" onclick={close}>
        {te('editor.slideshow.close', language)}
      </button>
    </span>
  </div>
</div>

<style>
  /* the strip that catches the hover: 60 px of the top edge, transparent */
  .exit-zone {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    z-index: 20;
  }

  /* canon: 48 px, rgba(22,22,24,.82), blur 6, 0 18px, 13px/600, white */
  .exit-bar {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18px;
    background: rgba(22, 22, 24, 0.82);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    color: #fff;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
    font-weight: 600;
    opacity: 0;
    transform: translateY(-100%);
    transition:
      opacity 0.16s ease,
      transform 0.16s ease;
  }
  .exit-zone:hover .exit-bar,
  .exit-bar.focused,
  .exit-zone.pinned .exit-bar {
    opacity: 1;
    transform: translateY(0);
  }

  .exit-right {
    display: flex;
    gap: 22px;
  }

  .exit-btn {
    appearance: none;
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
  .exit-btn:hover {
    text-decoration: underline;
  }
  .exit-btn:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 3px;
    border-radius: 2px;
  }
</style>
