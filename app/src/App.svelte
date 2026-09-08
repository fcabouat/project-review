<script lang="ts">
  /**
   * Application wiring — THE ONLY layer that knows all three packages: build
   * the store (core's abstract runtime bound to runes), the hash router and
   * the persistence control on their browser adapters, then mount the pure
   * Shell (components) with everything as props. Nothing here renders more
   * than one component; nothing below imports a store, a router or an
   * adapter.
   *
   * Startup order: the localStorage snapshot is read RAW and replayed through
   * the strict parse — a corrupted or outdated snapshot must never keep the
   * application from starting; anything the parse refuses falls back to an
   * EMPTY portfolio (identity pre-filled, no content — the sample sets load on
   * demand from Settings). When local save is on, the undo/redo history is
   * stored alongside the snapshot and restored with it.
   */
  import { parsePortfolio } from '@project-review/core/services/parse'
  import { emptyPortfolio } from '@project-review/core/data/empty-portfolio'
  import type { Language } from '@project-review/core/model/theme'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { History } from '@project-review/core/events/history'
  import { isoDate, type IsoDate } from '@project-review/core/values/date'
  import {
    STORAGE_KEY,
    loadHistory,
    loadPersistEnabled,
    loadRaw,
  } from '@project-review/core/services/persistence'
  import PrintView from '@project-review/components/slideshow/PrintView.svelte'
  import { STANDALONE_REVEAL_OPTIONS } from '@project-review/components/slideshow/reveal-options'
  import Shell from '@project-review/components/screens/Shell.svelte'
  import { defaultStorage } from '@project-review/infrastructure/local-storage'
  import { timeoutScheduler } from '@project-review/infrastructure/scheduler'
  import { applyFont } from '@project-review/infrastructure/fonts'
  import { saveStandalone } from '@project-review/infrastructure/dom-export'
  import { createStore } from './bindings/runtime.svelte'
  import { createRouter } from './bindings/route.svelte'
  import { createPersistenceControl } from './bindings/persistence-control.svelte'
  import { bundledSample, shouldBootSample } from './sample-boot'

  const storage = defaultStorage()

  /**
   * ONE multilingual artifact, no per-build stamp: the first boot (no stored
   * base) auto-detects — a browser announcing French gets fr, every other
   * locale gets en. Afterwards the snapshot's language wins (it travels inside
   * the portfolio), and `<html lang>` follows the setting reactively below.
   */
  function initialLanguage(): Language {
    const candidate = typeof navigator !== 'undefined' ? navigator.language : ''
    return candidate.toLowerCase().startsWith('fr') ? 'fr' : 'en'
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

  function initialState(): { portfolio: Portfolio; log?: History } {
    if (storage && persistEnabled) {
      const stored = loadRaw(storage)
      if (stored !== null) {
        const replayed = parsePortfolio(stored)
        // The history refers to THAT present: restored only together with it.
        if (replayed.ok) {
          return { portfolio: replayed.portfolio, log: loadHistory(storage) ?? undefined }
        }
      }
    }
    // `?sample` — the landing's « Try it » link: a full demo on the first
    // click, in the detected language. Only when NOTHING is stored: an
    // existing base is never overwritten (policy in `sample-boot.ts`).
    const search = typeof location !== 'undefined' ? location.search : ''
    if (shouldBootSample(search, storage?.getItem(STORAGE_KEY) ?? null)) {
      const sample = bundledSample(initialLanguage())
      if (sample) return { portfolio: sample }
    }
    return { portfolio: emptyPortfolio(initialLanguage(), today()) }
  }

  const initial = initialState()
  const store = createStore(initial.portfolio, initial.log)
  const router = createRouter()
  const persistence = createPersistenceControl(store, storage, persistEnabled, timeoutScheduler)

  /** « Enregistrer » — infrastructure's DOM export, reveal options bound here:
   * the infrastructure never imports components, the app hands the set over. */
  const exportStandalone = (slidesEl: HTMLElement, portfolio: Portfolio): Promise<void> =>
    saveStandalone(slidesEl, portfolio, STANDALONE_REVEAL_OPTIONS)

  // Reads `present`, so it re-runs on every dispatch/undo/redo — debounced to
  // 500 ms; the wiring re-checks the switch at fire time.
  $effect(() => {
    persistence.scheduleSnapshot(store.present)
  })

  // Same cadence for the history: past and future are plain event arrays.
  $effect(() => {
    persistence.scheduleHistory({ past: store.past, future: store.future })
  })

  // Live font: reacts to settings.theme.font — Google Fonts on demand.
  $effect(() => {
    applyFont(store.present.settings.theme.font)
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
  // the editor, the slideshow and `?print` re-color together.
  $effect(() => {
    document.documentElement.dataset.palette = store.present.settings.theme.palette
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
{:else}
  <Shell
    portfolio={store.present}
    past={store.past}
    future={store.future}
    dispatch={store.dispatch}
    undo={store.undo}
    redo={store.redo}
    route={router.route}
    navigate={router.navigate}
    replaceRoute={router.replace}
    persistence={persistence.control}
    {exportStandalone}
  />
{/if}
