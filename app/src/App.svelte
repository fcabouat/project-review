<script lang="ts">
  /**
   * Application wiring — THE ONLY layer that knows all three packages: build
   * the store (core's abstract runtime bound to runes), the hash router and
   * the persistence control on their browser adapters, then mount the pure
   * Shell (components) with everything as props. Nothing here renders more
   * than one component; nothing below imports a store, a router or an
   * adapter.
   *
   * Startup order: the localStorage snapshot is read through the strict parse
   * (`readSnapshot`), which answers one of three things — and the three are
   * kept apart on purpose:
   *  - `absent`: a first run. Empty portfolio (identity pre-filled, no
   *    content), or the `?sample` set when the URL asks for it;
   *  - `restored`: the portfolio runs, and with it the undo/redo history
   *    stored alongside;
   *  - `unreadable`: data IS there and the format refuses it. The application
   *    starts on an empty portfolio it NEVER saves — the persistence control
   *    is built blocked — and shows the recovery screen instead of the editor,
   *    so a person decides. A corrupted snapshot must not keep the app from
   *    starting; it must not be overwritten either.
   * The snapshot is read whatever the local-save switch says: the switch
   * governs writing, and the one thing that must never happen is writing over
   * something we could not read. The switch obeys the same rule on its own
   * account — turning the save back on re-reads the storage first (see
   * `persistence-control`), so the invariant holds at boot AND later.
   */
  import { emptyPortfolio } from '@project-review/core/data/empty-portfolio'
  import type { Language } from '@project-review/core/model/theme'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { History } from '@project-review/core/events/history'
  import { isoDate, type IsoDate } from '@project-review/core/values/date'
  import {
    loadHistory,
    loadPersistEnabled,
    readSnapshot,
    type StoredSnapshot,
  } from '@project-review/core/services/persistence'
  import PrintView from '@project-review/components/slideshow/PrintView.svelte'
  import { STANDALONE_REVEAL_OPTIONS } from '@project-review/components/slideshow/reveal-options'
  import Shell from '@project-review/components/screens/Shell.svelte'
  import RecoveryScreen from '@project-review/components/screens/RecoveryScreen.svelte'
  import { defaultStorage } from '@project-review/infrastructure/local-storage'
  import { timeoutScheduler } from '@project-review/infrastructure/scheduler'
  import {
    applyDeployedFont,
    applyEmbeddedFonts,
    applyFont,
    embeddedFamilies,
    probeFont,
    readWoff2File,
  } from '@project-review/infrastructure/fonts'
  import { applyCustomPalette } from '@project-review/infrastructure/palette'
  import { saveStandalone } from '@project-review/infrastructure/dom-export'
  import { MediaQuery } from 'svelte/reactivity'
  import { createStore } from './bindings/runtime.svelte'
  import { createRouter } from './bindings/route.svelte'
  import { createPersistenceControl } from './bindings/persistence-control.svelte'
  import { createAppearance } from './bindings/appearance.svelte'
  import { createFontStatus } from './bindings/font-status.svelte'
  import { detectLanguage } from './sample-boot'

  interface Props {
    /** The `?sample` set `main.ts` resolved BEFORE mounting (sample-boot.ts):
     * already through the strict parse, `undefined` in every other case. */
    readonly sampleBoot?: Portfolio
  }

  let { sampleBoot }: Props = $props()

  const storage = defaultStorage()

  /**
   * ONE multilingual artifact, no per-build stamp: the first boot (no stored
   * base) auto-detects — a browser announcing French gets fr, every other
   * locale gets en. Afterwards the snapshot's language wins (it travels inside
   * the portfolio), and `<html lang>` follows the setting reactively below.
   */
  function initialLanguage(): Language {
    return detectLanguage(typeof navigator !== 'undefined' ? navigator.language : '')
  }

  /** Local date (not UTC): the pre-filled review date is what the user sees on the wall. */
  function today(): IsoDate {
    const d = new Date()
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return isoDate(stamp)!
  }

  /**
   * `?print` — the deck laid flat, ready for Chrome's print preview (34 A4
   * landscape pages). Read once at startup, on the raw query string — deliberately
   * NOT a hash route: the editor is not even mounted, so nothing else can be
   * printed by mistake.
   */
  const printMode =
    typeof location !== 'undefined' && new URLSearchParams(location.search).has('print')

  const persistEnabled = storage ? loadPersistEnabled(storage) : false

  /** The storage's verdict, read ONCE — the boot and the write guard below
   * both hang on it. No storage at all is the same case as nothing stored. */
  const snapshot: StoredSnapshot = storage ? readSnapshot(storage) : { state: 'absent' }

  function initialState(): { portfolio: Portfolio; log?: History } {
    if (storage && persistEnabled && snapshot.state === 'restored') {
      // The history refers to THAT present: restored only together with it.
      return { portfolio: snapshot.portfolio, log: loadHistory(storage) ?? undefined }
    }
    // `?sample` — the landing's « Try it » link: a full demo on the first
    // click. `main.ts` already applied the whole policy (URL asks, nothing
    // stored, neighbour file fetched and strictly parsed) before mounting.
    if (sampleBoot) return { portfolio: sampleBoot }
    return { portfolio: emptyPortfolio(initialLanguage(), today()) }
  }

  const initial = initialState()
  const store = createStore(initial.portfolio, initial.log)
  const router = createRouter()
  // The wiring receives the storage's verdict itself: built BLOCKED on an
  // unreadable snapshot (every write disarmed until the recovery screen's
  // explicit decision), and it re-reads the storage whenever the switch is
  // turned back on — the same rule, at the one write path a boot cannot see.
  const persistence = createPersistenceControl(
    store,
    storage,
    persistEnabled,
    timeoutScheduler,
    snapshot,
  )
  const appearance = createAppearance(storage)
  const systemDark = new MediaQuery('(prefers-color-scheme: dark)')
  const fontStatus = createFontStatus((family) => probeFont(family))

  /**
   * The reveal.js UMD source (`window.Reveal`), fetched lazily as raw text.
   * Relative path on purpose: the package's `exports` map does not expose
   * `./dist/reveal.js` (the UMD build), only the entry points — a direct file
   * import is the supported Vite escape hatch for `?raw`, and naming it is the
   * WIRING's job: the infrastructure package receives a loader, never a path.
   */
  const loadEngineSource = async (): Promise<string> =>
    (await import('../../node_modules/reveal.js/dist/reveal.js?raw')).default

  /** « Enregistrer » — infrastructure's DOM export, reveal options and engine
   * loader bound here: the infrastructure never imports components nor names
   * node_modules, the app hands both over. */
  const exportStandalone = (slidesEl: HTMLElement, portfolio: Portfolio): Promise<void> =>
    saveStandalone(slidesEl, portfolio, STANDALONE_REVEAL_OPTIONS, loadEngineSource)

  // Reads `present`, so it re-runs on every dispatch/undo/redo — debounced to
  // 500 ms; the wiring re-checks the switch at fire time.
  $effect(() => {
    persistence.scheduleSnapshot(store.present)
  })

  // Same cadence for the history: past and future are plain event arrays.
  $effect(() => {
    persistence.scheduleHistory({ past: store.past, future: store.future })
  })

  // Live font: reacts to settings.theme.font AND the embedded faces. Three
  // local sources, no third party ever (fonts.ts): the embedded rules go in
  // first so they outrank everything, the deployed faces are declared for the
  // named family, the stack is set, and the Settings card is told which source
  // actually applies.
  $effect(() => {
    const theme = store.present.settings.theme
    const embedded = embeddedFamilies(theme.fontFaces)
    applyEmbeddedFonts(theme.fontFaces)
    applyDeployedFont(theme.font, document, embedded)
    applyFont(theme.font, document)
    fontStatus.watch(theme.font, embedded)
  })

  // Reader scheme → the `dark` class on <html> (tokens.css flips the editor
  // chrome; the slides pin their light values). `system` follows the OS live.
  // `?print` opts out: printing is a slides affair, light by construction.
  $effect(() => {
    const dark =
      appearance.scheme === 'dark' || (appearance.scheme === 'system' && systemDark.current)
    document.documentElement.classList.toggle('dark', dark && !printMode)
  })

  // Live slide style: the templates scope their 'flat' rules under this root
  // attribute (`flat.css`). The effect lives HERE, outside the print/editor
  // fork below, so `?print` — which never mounts the editor — is themed too.
  // Root attribute on the app's own document: no cleanup needed.
  $effect(() => {
    document.documentElement.dataset.slideStyle = store.present.settings.theme.style
  })

  // Live palette: the category colors are CSS custom properties scoped under
  // this root attribute (`palettes.css`) — same reach as the slide style, so
  // the editor, the slideshow and `?print` re-color together. A palette the
  // PORTFOLIO carries wins over the chosen family, as the twelve properties
  // set inline on the same root (`applyCustomPalette`); dropping it removes
  // them and the family applies again.
  $effect(() => {
    const theme = store.present.settings.theme
    document.documentElement.dataset.palette = theme.palette
    applyCustomPalette(theme.customPalette, document)
  })

  // Live <html lang>: the single artifact speaks both languages, so the
  // attribute follows the setting (screen readers, hyphenation, print) —
  // replacing the per-build stamp of the former fr/en deliverables. The
  // standalone slideshow export stays frozen at export time (dom-export reads
  // `portfolio.settings.language` when the file is written).
  $effect(() => {
    document.documentElement.lang = store.present.settings.language
  })

  // Live tab title — the other half of the former per-build stamp: the review
  // title is the natural document title, and its blank-start default is
  // already localized (`emptyPortfolio`).
  $effect(() => {
    document.title = store.present.review.title
  })
</script>

<svelte:window onpagehide={() => persistence.flush()} />

{#if printMode}
  <PrintView portfolio={store.present} />
{:else if persistence.unreadable}
  <!-- Data is stored that the format refuses: the editor stays closed until
       someone decides, so no edit can start a save cycle over it. -->
  <RecoveryScreen
    language={store.present.settings.language}
    refusal={persistence.unreadable.refusal}
    raw={persistence.unreadable.raw}
    startEmpty={() => persistence.discard()}
  />
{:else}
  <Shell
    portfolio={store.present}
    past={store.past}
    future={store.future}
    canUndo={store.canUndo}
    canRedo={store.canRedo}
    dispatch={store.dispatch}
    undo={store.undo}
    redo={store.redo}
    route={router.route}
    navigate={router.navigate}
    replaceRoute={router.replace}
    persistence={persistence.control}
    {appearance}
    fontStatus={fontStatus.status}
    readFontFile={readWoff2File}
    {exportStandalone}
  />
{/if}
