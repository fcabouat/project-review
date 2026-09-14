<script lang="ts">
  /**
   * Application wiring — THE ONLY layer that knows all three packages: build
   * the store (core's abstract runtime bound to runes), the hash router and
   * the persistence control on their browser adapters, then mount the pure
   * Shell (components) with everything as props. Nothing here renders more
   * than one component; nothing below imports a store, a router or an
   * adapter.
   *
   * Startup order: the stored envelope is read through the strict parse
   * (`readStored`), which answers one of four things — and the four are
   * kept apart on purpose:
   *  - `absent`: a first run. Empty portfolio (identity pre-filled, no
   *    content), or the `?sample` set when the URL asks for it;
   *  - `restored`: the portfolio runs, and with it the undo/redo history that
   *    travelled in the same bytes — so the log can only ever describe the
   *    document it is replayed against;
   *  - `unreadable`: data IS there and the format refuses it. The application
   *    starts on an empty portfolio it NEVER saves — the persistence control
   *    is built blocked — and shows the recovery screen instead of the editor,
   *    so a person decides. A corrupted document must not keep the app from
   *    starting; it must not be overwritten either;
   *  - `unavailable`: the browser refuses local storage outright. The editor
   *    starts and works in full; the save strip says, permanently, that this
   *    document lives in this tab alone, and offers the copy that keeps it.
   *    A storage the app cannot have must not cost the app its startup.
   * The storage is read whatever the local-save switch says: the switch
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
    loadPersistEnabled,
    readStored,
    type StoredState,
  } from '@project-review/core/services/persistence'
  import PrintView from '@project-review/components/slideshow/PrintView.svelte'
  import { STANDALONE_REVEAL_OPTIONS } from '@project-review/components/slideshow/reveal-options'
  import Shell from '@project-review/components/screens/Shell.svelte'
  import RecoveryScreen from '@project-review/components/screens/RecoveryScreen.svelte'
  import DemoUnavailable from '@project-review/components/screens/DemoUnavailable.svelte'
  import { defaultStorage, watchStored } from '@project-review/infrastructure/local-storage'
  import { timeoutScheduler } from '@project-review/infrastructure/scheduler'
  import {
    applyDeployedFont,
    applyEmbeddedFonts,
    applyFont,
    embeddedFamilies,
    probeFont,
    readWoff2File,
  } from '@project-review/infrastructure/fonts'
  import { readImageFile } from '@project-review/infrastructure/image'
  import { applyCustomPalette } from '@project-review/infrastructure/palette'
  import { saveStandalone } from '@project-review/infrastructure/dom-export'
  import { MediaQuery } from 'svelte/reactivity'
  import { flushSync, onDestroy, untrack } from 'svelte'
  import type { Command } from '@project-review/core/commands'
  import type { DomainEvent } from '@project-review/core/events'
  import { invert } from '@project-review/core/events/invert'
  import { createStore } from './bindings/runtime.svelte'
  import { createRouter } from './bindings/route.svelte'
  import { createPersistenceControl } from './bindings/persistence-control.svelte'
  import { remapCollectionDrafts } from './bindings/collection-drafts'
  import { createAppearance } from './bindings/appearance.svelte'
  import { createFontStatus } from './bindings/font-status.svelte'
  import { detectLanguage, type DemoBoot } from './sample-boot'

  interface Props {
    /** The `?sample` set `main.ts` resolved BEFORE mounting (sample-boot.ts):
     * already through the strict parse, `undefined` in every other case. */
    readonly sampleBoot?: DemoBoot
  }

  let { sampleBoot }: Props = $props()

  const demo = untrack(() => sampleBoot !== undefined)
  const demoLanguage = detectLanguage(
    typeof navigator !== 'undefined' ? navigator.language : '',
    typeof location !== 'undefined' ? location.search : '',
  )

  // A demo has no persistence boundary at all. In particular, do not even
  // obtain the local-storage adapter: sample viewing must never inspect or
  // adopt a user's portfolio/history/drafts.
  const storage = demo ? null : defaultStorage()

  /**
   * ONE multilingual artifact, no per-build stamp: the first boot (no stored
   * base) auto-detects — a browser announcing French gets fr, every other
   * locale gets en. Afterwards the stored document's language wins (it travels inside
   * the portfolio), and `<html lang>` follows the setting reactively below.
   */
  function initialLanguage(): Language {
    return detectLanguage(
      typeof navigator !== 'undefined' ? navigator.language : '',
      typeof location !== 'undefined' ? location.search : '',
    )
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

  const persistEnabled = storage !== null && loadPersistEnabled(storage)

  /** The storage's verdict, read ONCE — the boot and the write guard below
   * both hang on it. A browser with no storage is its own verdict
   * (`unavailable`), which the shell states permanently rather than miming a
   * save nobody performs. */
  const storedState: StoredState = readStored(storage)

  function initialState(): { portfolio: Portfolio; log?: History } {
    if (persistEnabled && storedState.state === 'restored') {
      // One envelope: the log came out of the same bytes as the portfolio, so
      // it cannot describe another document.
      return { portfolio: storedState.portfolio, log: storedState.history }
    }
    // Read-only demo: the complete fictional set is loaded before mounting,
    // independently of any existing portfolio (storage is null in this mode).
    if (sampleBoot?.portfolios[demoLanguage])
      return { portfolio: sampleBoot.portfolios[demoLanguage]! }
    return { portfolio: emptyPortfolio(initialLanguage(), today()) }
  }

  const initial = initialState()
  const store = createStore(initial.portfolio, initial.log)
  const router = createRouter()
  // The wiring receives the storage's verdict itself: built BLOCKED on an
  // unreadable envelope (every write disarmed until the recovery screen's
  // explicit decision), and carrying the stored REVISION — the value every
  // later write compares against before it overwrites anything.
  const persistence = createPersistenceControl(
    store,
    storage,
    persistEnabled,
    timeoutScheduler,
    storedState,
  )
  // Explicit document/history choices win over old raw input, including when
  // an imported field happens to equal the previous model value.
  function clearDrafts(prefix?: readonly string[]): void {
    const start = prefix === undefined ? undefined : JSON.stringify(prefix).slice(0, -1) + ','
    persistence.drafts.reset?.(
      start === undefined
        ? []
        : persistence.drafts.snapshot?.filter((draft) => !draft.key.startsWith(start)),
    )
  }
  function invalidateDrafts(event: DomainEvent | undefined): void {
    if (event?.type === 'PortfolioReplaced' || event?.type === 'ProjectsMerged') clearDrafts()
    if (event?.type === 'ProjectDeleted') clearDrafts(['project', event.project.id])
    if (event?.type === 'ProjectRenumbered') clearDrafts(['project', event.oldId])
    if (event?.type === 'CategoryDeleted') clearDrafts(['category', event.category.id])
    if (event?.type === 'FreeSlideDeleted') clearDrafts(['slide', event.slide.id])
    // These collections have positional rows, not permanent row IDs.
    if (
      (event?.type === 'ProjectMilestonesChanged' || event?.type === 'ProjectDecisionsChanged') &&
      event.before.length !== event.after.length
    )
      persistence.drafts.reset?.(remapCollectionDrafts(persistence.drafts.snapshot ?? [], event))
  }
  function dispatch(command: Command) {
    if (demo) return undefined
    const event = store.dispatch(command)
    invalidateDrafts(event)
    return event
  }
  function moveHistory(move: () => void, event: DomainEvent | undefined): void {
    if (demo) return
    move()
    invalidateDrafts(event)
  }
  onDestroy(persistence.dispose)
  const appearance = createAppearance(storage)
  const systemDark = new MediaQuery('(prefers-color-scheme: dark)')
  const fontStatus = createFontStatus((family) => probeFont(family))

  function switchDemoLanguage(next: Language): void {
    const portfolio = sampleBoot?.portfolios[next]
    if (demo && portfolio) store.dispatch({ type: 'ReplacePortfolio', portfolio })
  }

  /**
   * The reveal.js UMD source (`window.Reveal`), fetched lazily as raw text.
   * Vite resolves the package's require export to the UMD build, without
   * assuming a flat node_modules layout. The infrastructure receives a
   * loader, never a package path.
   */
  const loadEngineSource = async (): Promise<string> =>
    (await import('reveal.js/standalone?raw')).default

  /** « Enregistrer » — infrastructure's DOM export, reveal options and engine
   * loader bound here: the infrastructure never imports components nor names
   * node_modules, the app hands both over. */
  const exportStandalone = (slidesEl: HTMLElement, portfolio: Portfolio): Promise<void> =>
    saveStandalone(slidesEl, portfolio, STANDALONE_REVEAL_OPTIONS, loadEngineSource)

  // Reads `present` AND both stacks, so it re-runs on every dispatch/undo/redo
  // — debounced to 500 ms, and the portfolio and its log go out as ONE
  // envelope; the wiring re-checks the switch and the stored revision at fire
  // time.
  $effect(() => {
    persistence.scheduleSave(store.present, { past: store.past, future: store.future })
  })
  $effect(() => persistence.scheduleDrafts())

  // The other tab wrote: the browser says so on this very document. Hearing it
  // turns a conflict into something the user is TOLD about, instead of
  // something they discover at the next deadline.
  $effect(() =>
    storage === null ? undefined : watchStored(() => persistence.noticeStoredChange()),
  )

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

<!-- Lifecycle hooks complement the periodic checkpoint: neither is guaranteed
     after a crash. Settle field effects synchronously before the final write. -->
<svelte:window onpagehide={persistence.flush} />
<svelte:document
  onvisibilitychange={() => {
    if (document.visibilityState === 'hidden') {
      flushSync()
      persistence.checkpoint()
    }
  }}
/>

{#if demo && sampleBoot?.error}
  <DemoUnavailable language={demoLanguage} retry={() => location.reload()} />
{:else if printMode}
  <PrintView portfolio={store.present} />
{:else if persistence.unreadable}
  <!-- Data is stored that the format refuses: the editor stays closed until
       someone decides, so no edit can start a save cycle over it. -->
  <RecoveryScreen
    language={store.present.settings.language}
    refusal={persistence.unreadable.refusal}
    raw={persistence.unreadable.raw}
    startEmpty={() => persistence.discard()}
    startEmptyRefused={persistence.discardRefused}
  />
{:else}
  <Shell
    portfolio={store.present}
    past={store.past}
    future={store.future}
    canUndo={store.canUndo}
    canRedo={store.canRedo}
    {dispatch}
    undo={() => {
      const event = store.past.at(-1)
      moveHistory(store.undo, event === undefined ? undefined : invert(event))
    }}
    redo={() => moveHistory(store.redo, store.future[0])}
    route={router.route}
    navigate={router.navigate}
    replaceRoute={router.replace}
    persistence={demo ? undefined : persistence.control}
    drafts={persistence.drafts}
    {appearance}
    fontStatus={fontStatus.status}
    readFontFile={readWoff2File}
    readLogoFile={readImageFile}
    {exportStandalone}
    readOnly={demo}
    {demo}
    onDemoLanguage={switchDemoLanguage}
  />
{/if}
