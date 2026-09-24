<script lang="ts">
  /**
   * Application shell: dark full-height sidebar, light
   * top bar, and one screen per route — `#/review`, `#/projects`, `#/sheet/{id}`,
   * `#/settings`, `#/history`, `#/about`.
   *
   * Everything shown here is DERIVED from `portfolio` at read time — the deck
   * counter, the tracked/archived counts, the undo badge (law 3: nothing derived
   * is stored). Every interaction dispatches a Command; no view ever writes into
   * the portfolio.
   *
   * Pure screen at the top of the pile: the current `route` and the `navigate`
   * callback come in as props — the sidebar keeps real `#/…` hrefs for
   * accessibility (open in new tab, copy link) but the navigation itself goes
   * through `navigate`, so the shell works identically under the app's hash
   * router and a story's in-memory route.
   *
   * Below `lg` (1024 px) the sidebar becomes a DRAWER (the vendored `sheet`
   * primitive, hamburger in the top bar, Escape/overlay to close): same nav
   * markup in both homes, one snippet — the drawer only widens the touch rows.
   */
  import '../editor/editor.css'
  import { tick, untrack } from 'svelte'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { DomainEvent } from '@project-review/core/events'
  import { deck, isArchived, isTracked } from '@project-review/core/projections'
  import { LANGUAGES } from '@project-review/core/model/theme'
  import { te } from '../i18n'
  import { identityLine } from '../commons/identity-line'
  import Icon from '../commons/Icon.svelte'
  import { Badge } from '../commons/ui/badge'
  import { Button } from '../commons/ui/button'
  import * as DropdownMenu from '../commons/ui/dropdown-menu'
  import { Separator } from '../commons/ui/separator'
  import * as Sheet from '../commons/ui/sheet'
  import { provideDrafts } from '../editor/FieldText.svelte'
  import ImportExportDialog from '../editor/ImportExportDialog.svelte'
  import SaveStateBar from '../editor/SaveStateBar.svelte'
  import SlideshowHost, { provideSlideshow } from '../slideshow/SlideshowHost.svelte'
  import type {
    AppearanceControl,
    ColorScheme,
    Dispatch,
    DraftRegistry,
    FontStatus,
    PersistenceControl,
    Route,
  } from './contracts'
  import ReviewScreen from './ReviewScreen.svelte'
  import ProjectsScreen from './ProjectsScreen.svelte'
  import SettingsScreen from './SettingsScreen.svelte'
  import SheetScreen from './SheetScreen.svelte'
  import HistoryScreen from './HistoryScreen.svelte'
  import AboutScreen from './AboutScreen.svelte'

  interface Props {
    readonly portfolio: Portfolio
    /** Applied events, oldest first — the undo badge and the history screen. */
    readonly past: readonly DomainEvent[]
    /** Undone events, in redo order. */
    readonly future: readonly DomainEvent[]
    /** The store's own predicates — the shell displays them, never re-derives
     * them from the stacks (one source of truth for "can undo"). */
    readonly canUndo: boolean
    readonly canRedo: boolean
    readonly dispatch: Dispatch
    readonly undo: () => void
    readonly redo: () => void
    /** Current screen — the host's router (or a story's local state). */
    readonly route: Route
    /** Pushes a new history entry. */
    readonly navigate: (route: Route) => void
    /** Replaces the current entry — redirects (unknown sheet id). */
    readonly replaceRoute: (route: Route) => void
    /** Local-save switch (Settings ▸ Data); absent → the row is not shown. */
    readonly persistence?: PersistenceControl
    /**
     * Where the text fields under this shell announce input they hold and the
     * document does not (`../editor/drafts`). The host provides it because the
     * host is what commits those drafts when the page closes and what must not
     * report « saved » over them; absent — a story — the fields register
     * nowhere and nothing else changes.
     */
    readonly drafts?: DraftRegistry
    /** Reader scheme picker (Settings ▸ Appearance); absent → row not shown. */
    readonly appearance?: AppearanceControl
    /** Live verdict on the theme font (Settings ▸ Appearance). */
    readonly fontStatus?: FontStatus
    /** Host-injected reader of picked font files (Settings ▸ Appearance). */
    readonly readFontFile?: (file: File) => Promise<string | null>
    /** Host-injected reader of the picked logo file (Settings ▸ Appearance). */
    readonly readLogoFile?: (file: File) => Promise<string | null>
    /**
     * « Enregistrer » — the standalone .html. Injected by the app
     * (infrastructure's dom-export, reveal options bound); layering forbids
     * the reverse import. Absent — a story — the button is a no-op.
     */
    readonly exportStandalone?: (slidesEl: HTMLElement, portfolio: Portfolio) => Promise<void>
    readonly readOnly?: boolean
    readonly demo?: boolean
    readonly onDemoLanguage?: (language: (typeof LANGUAGES)[number]) => void
  }

  let {
    portfolio,
    past,
    future,
    canUndo,
    canRedo,
    dispatch,
    undo,
    redo,
    route,
    navigate,
    replaceRoute,
    persistence,
    drafts,
    appearance,
    fontStatus,
    readFontFile,
    readLogoFile,
    exportStandalone,
    readOnly = false,
    demo = false,
    onDemoLanguage,
  }: Props = $props()

  let dialogTab = $state<'export' | 'import' | undefined>(undefined)
  let navCollapsed = $state(false)
  /** Mobile nav drawer (below `lg`) — closed on every navigation. */
  let drawerOpen = $state(false)
  /**
   * Slideshow: an OVERLAY, not a route (it covers the current screen and must
   * come back to it). `undefined` means "not mounted" — and while it is not
   * mounted, reveal.js is not even downloaded. The number is the
   * 0-based deck position to open on.
   */
  let slideshowAt = $state<number | undefined>(undefined)

  // Published to the whole subtree so the slide preview's «Ouvrir le diaporama
  // ici ▸» reaches the shell without four layers of prop threading.
  provideSlideshow((index) => (slideshowAt = index ?? 0))
  // Same seam, the other direction: the fields announce their drafts to the
  // host instead of the host threading a registry down to every one of them.
  // Read ONCE and deliberately: a host builds one registry for the life of
  // the shell, and a context value cannot be re-published anyway.
  provideDrafts(untrack(() => drafts))

  const language = $derived(portfolio.settings.language)
  const trackedCount = $derived(portfolio.projects.filter(isTracked).length)
  const archivedCount = $derived(portfolio.projects.filter(isArchived).length)
  const slideCount = $derived(deck(portfolio).length)
  /** Blank-identity grace: filled parts only — empty until the user types theirs. */
  const entity = $derived(
    identityLine(' · ', portfolio.settings.identity.org, portfolio.settings.identity.unit),
  )
  const initial = $derived(portfolio.review.title.trim().slice(0, 1).toUpperCase() || 'R')
  /** Visually hidden h1 — one heading root per screen for assistive tech. */
  const screenTitle = $derived(
    route.name === 'sheet'
      ? te('editor.screen.sheet', language, { id: route.id })
      : te(`editor.nav.${route.name}`, language),
  )

  /** Real href for accessibility, `navigate` for the actual move. */
  function follow(event: MouseEvent, next: Route): void {
    event.preventDefault()
    drawerOpen = false
    navigate(next)
  }

  /** Data-group dialogs, from either nav home — the drawer closes first. */
  function openDialog(tab: 'export' | 'import'): void {
    drawerOpen = false
    dialogTab = tab
  }

  /** Skip link: focus the content without touching the hash (the app's OWN
   * hash router would read `#main` as a route). */
  function skipToContent(event: MouseEvent): void {
    event.preventDefault()
    document.getElementById('main')?.focus()
  }

  /** Undo/redo belong to editing, not to the presentation or a field's native history. */
  function onkeydown(event: KeyboardEvent): void {
    if (readOnly || slideshowAt !== undefined || event.defaultPrevented) return
    if (!(event.ctrlKey || event.metaKey)) return
    const key = event.key.toLowerCase()
    if (key !== 'z' && key !== 'y') return
    const target = event.target as HTMLElement | null
    if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return
    event.preventDefault()
    if (key === 'y' || event.shiftKey) redo()
    else undo()
  }

  /** The top-bar scheme menu, the language menu's twin: three choices with a
   * check mark on the current one — the trigger shows the EFFECTIVE state. */
  const SCHEME_OPTIONS: readonly {
    value: ColorScheme
    icon: 'contrast-line' | 'sun-line' | 'moon-line'
  }[] = [
    { value: 'system', icon: 'contrast-line' },
    { value: 'light', icon: 'sun-line' },
    { value: 'dark', icon: 'moon-line' },
  ]

  /** Shared look of the two compact top-bar menu triggers. */
  const menuTrigger =
    'border-input text-(--txt2) bg-background hover:bg-accent hover:text-accent-foreground ' +
    'focus-visible:outline-ring inline-flex cursor-pointer items-center gap-1 rounded-md border ' +
    'px-[9px] py-[7px] text-xs font-bold whitespace-nowrap focus-visible:-outline-offset-2 ' +
    'focus-visible:outline-2 max-lg:min-h-11 max-lg:px-3'

  /**
   * « Générer le diaporama » — bound so closing the slideshow can RESTORE the
   * focus to the button that opened it (the overlay unmounts, and without
   * this the keyboard lands back on `<body>`). `tick()` first: the editor is
   * `inert` until the overlay is actually gone.
   */
  let generateButton = $state<HTMLElement | null>(null)

  function closeSlideshow(): void {
    slideshowAt = undefined
    void tick().then(() => generateButton?.focus())
  }

  /** One anchor/button shape for both nav homes; `tall` is the drawer's
   * touch-target variant (≥ 44 px rows), the desktop rail keeps its 36 px. */
  const navItem = (active: boolean, tall: boolean): string =>
    [
      'flex w-full cursor-pointer items-center gap-2 border-l-[3px] px-[18px]',
      'text-left text-[13.5px] no-underline',
      'focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring',
      tall ? 'min-h-11' : 'h-9',
      active
        ? 'border-l-(--accent-main) bg-(--accent-main)/20 font-bold text-white'
        : 'border-transparent font-semibold text-white/70 hover:bg-white/5 hover:text-white',
    ].join(' ')
</script>

<svelte:window {onkeydown} />

<!-- One nav body, two homes: the permanent rail (≥ lg) and the drawer below.
     Declared at the top level so both mount points share the ONE markup. -->
{#snippet navBody(tall: boolean)}
  <div class="flex items-center gap-2.5 px-3.5 pt-1 pb-4">
    <span
      class="bg-(--accent-main) grid size-9 flex-none place-items-center rounded-[10px] text-[15px] font-extrabold text-white"
      aria-hidden="true">{initial}</span
    >
    <span>
      <b class="block text-sm leading-[1.2] font-extrabold tracking-[-0.01em] text-white"
        >{portfolio.review.title}</b
      >{#if entity}<span class="mt-0.5 block text-[10.5px] leading-none font-semibold text-white/55"
          >{entity}</span
        >{/if}
    </span>
  </div>

  <!-- One anchor shape for the four routes; `activeOn` widens the
             highlight where a route covers a sub-route (projects → sheet). -->
  {#snippet navLink(target: Route, activeOn: readonly Route['name'][], label: string)}
    {@const active = activeOn.includes(route.name)}
    <a
      class={navItem(active, tall)}
      aria-current={active ? 'page' : undefined}
      href="#/{target.name}"
      onclick={(e) => follow(e, target)}
    >
      {label}
      {#if target.name === 'history' && past.length > 0}
        <Badge
          class="ml-auto h-4 min-w-4 px-1 text-[9.5px] font-bold {active
            ? 'bg-(--accent-main) text-white'
            : 'bg-white/20 text-white'}">{past.length}</Badge
        >
      {/if}
    </a>
  {/snippet}

  <div class="mb-5 flex flex-col">
    <span class="mb-1.5 px-[18px] text-[10.5px] font-bold tracking-[0.06em] text-white/55 uppercase"
      >{te('editor.nav.portfolio', language)}</span
    >
    {@render navLink({ name: 'review' }, ['review'], te('editor.nav.review', language))}
    {@render navLink(
      { name: 'projects' },
      ['projects', 'sheet'],
      te('editor.nav.projects', language),
    )}
    {@render navLink({ name: 'settings' }, ['settings'], te('editor.nav.settings', language))}
  </div>

  <div class="mb-5 flex flex-col">
    <span class="mb-1.5 px-[18px] text-[10.5px] font-bold tracking-[0.06em] text-white/55 uppercase"
      >{te('editor.nav.data', language)}</span
    >
    <button
      type="button"
      class={navItem(false, tall)}
      disabled={readOnly}
      onclick={() => openDialog('import')}
    >
      {te('editor.nav.import', language)}
    </button>
    <button type="button" class={navItem(false, tall)} onclick={() => openDialog('export')}>
      {te('editor.nav.export', language)}
    </button>
    {@render navLink({ name: 'history' }, ['history'], te('editor.nav.history', language))}
  </div>

  <div class="mt-auto border-t border-white/15 px-[18px] pt-3.5">
    <div class="mb-2.5 text-[11.5px] leading-[1.6] font-semibold text-white/60">
      {te('editor.foot.counts', language, { tracked: trackedCount, archived: archivedCount })}
      <br />
      {te('editor.foot.deck', language, { n: slideCount })}
    </div>
    <div class="text-[10px] leading-[1.55] font-medium text-white/55">
      {te('editor.about.built', language)}<br />
      {te('editor.about.author', language)}
    </div>
    <!-- The about block was already here: it becomes the door to the full
         screen, where the third-party notices travel with the artifact. -->
    <a
      class="focus-visible:outline-ring mt-1.5 inline-block text-[10.5px] font-semibold text-white/70 underline hover:text-white focus-visible:outline-2"
      href="#/about"
      onclick={(e) => follow(e, { name: 'about' })}
    >
      {te('editor.nav.about', language)}
    </a>
  </div>
{/snippet}

<!-- `inert` while the slideshow overlay covers the editor: the deck is the
     only reachable surface (tab order and assistive tech alike) — without it
     the keyboard walks the covered screens before ever meeting the exit bar. -->
<div class="editor" inert={slideshowAt !== undefined}>
  <a
    href="#main"
    onclick={skipToContent}
    class="focus:bg-background focus:text-foreground focus:outline-ring sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[1000] focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:outline-2"
  >
    {te('editor.nav.skip', language)}
  </a>
  <div class="bg-secondary min-h-screen">
    <div class="flex min-h-screen items-stretch">
      <nav
        class={navCollapsed
          ? 'hidden w-0 flex-[0_0_0px] overflow-hidden p-0'
          : 'hidden w-[216px] flex-[0_0_216px] flex-col bg-[#1b1b35] pt-3.5 pb-4 lg:flex'}
        aria-label={te('editor.nav.aria', language)}
      >
        {@render navBody(false)}
      </nav>

      <div class="flex min-w-0 flex-1 flex-col">
        <!-- Landmarks: header (top bar) + main (the screen) + the nav aside —
             everything readable sits in one, so a screen reader's landmark
             rotor covers the whole shell. -->
        <header
          class="border-border bg-background relative flex h-[60px] flex-none items-center justify-between gap-5 border-b px-[22px] max-lg:h-auto max-lg:min-h-[60px] max-lg:flex-wrap max-lg:justify-end max-lg:gap-x-2.5 max-lg:gap-y-1.5 max-lg:px-3 max-lg:py-2"
        >
          {#if demo}
            <span
              class="bg-primary text-primary-foreground mr-auto rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase"
              data-testid="demo-marker"
            >
              {te('editor.demo.marker', language)}
            </span>
          {/if}
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground max-lg:hidden"
            title={te(navCollapsed ? 'editor.nav.expand' : 'editor.nav.collapse', language)}
            aria-label={te(navCollapsed ? 'editor.nav.expand' : 'editor.nav.collapse', language)}
            onclick={() => (navCollapsed = !navCollapsed)}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground min-h-11 min-w-11 max-lg:mr-auto lg:hidden"
            aria-label={te('editor.nav.open', language)}
            onclick={() => (drawerOpen = true)}
          >
            <Icon name="menu-line" size="18px" />
          </Button>

          <!-- `max-lg:contents` dissolves the group into the header's own
               wrap below lg: items fold ONE BY ONE (the CTA alone moves to
               row two), never the whole group as a block — one row as long
               as the width allows, two at most, never three. -->
          <div class="flex items-center gap-2.5 max-lg:contents">
            <!-- Language menu: the same `ChangeSetting` command as Settings ▸
                 Language — undoable, and every label of the shell re-derives
                 from `portfolio.settings.language` on the spot. A compact
                 trigger (current code + chevron) so the bar stays ONE row as
                 long as the width allows; the review date lives with the rest
                 of the review data, on the Review screen. -->
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                class={menuTrigger}
                aria-label="{te('editor.topbar.language', language)} : {language.toUpperCase()}"
              >
                {language.toUpperCase()}
                <Icon name="arrow-down-s-line" size="14px" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" class="min-w-36">
                {#each LANGUAGES as candidate (candidate)}
                  <DropdownMenu.Item
                    class="cursor-pointer"
                    onclick={() =>
                      demo
                        ? onDemoLanguage?.(candidate)
                        : dispatch({
                            type: 'ChangeSetting',
                            setting: 'language',
                            after: candidate,
                          })}
                  >
                    <span class={language === candidate ? '' : 'invisible'} aria-hidden="true">
                      <Icon name="check-line" size="14px" />
                    </span>
                    {te(`editor.language.${candidate}`, language)}
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            {#if appearance}
              <!-- Scheme menu, the language menu's twin: language and scheme
                   are the two READER preferences, grouped here. Same store as
                   Settings ▸ Appearance — two views, one `AppearanceControl`.
                   The trigger shows the EFFECTIVE state, not the choice: sun
                   and moon swap on the live `dark` class, so `system` shows
                   whatever the OS resolved to — no JS asks the OS anything. -->
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  class={menuTrigger}
                  aria-label="{te('editor.setting.scheme', language)} : {te(
                    `editor.scheme.${appearance.scheme}`,
                    language,
                  )}"
                >
                  <span
                    class="inline-flex h-[15px] w-[15px] items-center justify-center dark:hidden"
                    ><Icon name="sun-line" size="15px" /></span
                  >
                  <span
                    class="hidden h-[15px] w-[15px] items-center justify-center dark:inline-flex"
                    ><Icon name="moon-line" size="15px" /></span
                  >
                  <Icon name="arrow-down-s-line" size="14px" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" class="min-w-36">
                  {#each SCHEME_OPTIONS as option (option.value)}
                    <DropdownMenu.Item
                      class="cursor-pointer"
                      onclick={() => appearance?.setScheme(option.value)}
                    >
                      <span
                        class={appearance.scheme === option.value ? '' : 'invisible'}
                        aria-hidden="true"
                      >
                        <Icon name="check-line" size="14px" />
                      </span>
                      <Icon name={option.icon} size="15px" />
                      {te(`editor.scheme.${option.value}`, language)}
                    </DropdownMenu.Item>
                  {/each}
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            {/if}
            <Separator orientation="vertical" class="h-[22px] min-h-0 self-center max-lg:hidden" />
            <!-- One wrap unit: when the narrow top bar folds, undo and redo
                 travel together instead of straddling two rows. -->
            <span class="flex items-center gap-2.5">
              <span class="relative inline-flex">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="text-muted-foreground max-lg:min-h-11 max-lg:min-w-11"
                  title={te('editor.topbar.undo', language)}
                  aria-label={te('editor.topbar.undo', language)}
                  disabled={readOnly || !canUndo}
                  onclick={() => undo()}
                >
                  ↶
                </Button>
                {#if past.length > 0}<Badge
                    class="bg-foreground text-background absolute -top-1 -right-1.5 h-4 min-w-4 px-1 text-[9.5px] font-bold"
                    >{past.length}</Badge
                  >{/if}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground max-lg:min-h-11 max-lg:min-w-11"
                title={te('editor.topbar.redo', language)}
                aria-label={te('editor.topbar.redo', language)}
                disabled={readOnly || !canRedo}
                onclick={() => redo()}
              >
                ↷
              </Button>
            </span>
            <Separator orientation="vertical" class="h-[22px] min-h-0 self-center max-lg:hidden" />
            <!-- Mounts the slideshow ON CLICK, never before: reveal.js is not part
                 of the editor's bundle and is fetched here. -->
            <Button
              bind:ref={generateButton}
              class="max-lg:min-h-11"
              title={te('editor.topbar.openSlideshow', language)}
              onclick={() => (slideshowAt = 0)}
            >
              {te('editor.topbar.slideshow', language)}
            </Button>
          </div>
        </header>
        {#if demo}
          <aside
            class="border-border bg-(--accent-main)/5 text-muted-foreground border-b px-5 py-2 text-center text-[11.5px]"
            data-testid="demo-readonly-notice"
          >
            {te('editor.demo.notice', language)}
            <a
              class="text-primary ml-1 underline"
              href={language === 'fr'
                ? '../fr.html#online-security'
                : '../index.html#online-security'}
            >
              {te('editor.demo.security', language)}
            </a>
          </aside>
        {/if}

        <!-- Where the document stands with the browser's storage, on EVERY
             screen and at all times — a refused write must never be something
             the user finds out about at the next reload. Absent only when
             nothing is being saved at all (switch off, or no storage). -->
        {#if persistence?.save}
          <SaveStateBar
            {portfolio}
            save={persistence.save}
            drafts={drafts?.snapshot}
            takeStored={() => persistence?.takeStored()}
            keepMine={() => persistence?.keepMine()}
          />
        {/if}

        <main id="main" tabindex="-1" class="min-h-0 min-w-0 flex-1 p-5 outline-none max-md:p-3">
          <h1 class="sr-only">{screenTitle}</h1>
          {#if route.name === 'review'}
            <ReviewScreen {portfolio} {dispatch} {readOnly} />
          {:else if route.name === 'projects'}
            <ProjectsScreen
              {portfolio}
              {dispatch}
              {readOnly}
              open={(id) => navigate({ name: 'sheet', id })}
            />
          {:else if route.name === 'settings'}
            <SettingsScreen
              {portfolio}
              {dispatch}
              {persistence}
              {appearance}
              {fontStatus}
              {readFontFile}
              {readLogoFile}
              {readOnly}
            />
          {:else if route.name === 'history'}
            <fieldset disabled={readOnly} class="contents">
              <HistoryScreen {portfolio} {past} {future} {undo} {redo} />
            </fieldset>
          {:else if route.name === 'about'}
            <AboutScreen {language} />
          {:else if route.name === 'sheet'}
            <SheetScreen
              {portfolio}
              {dispatch}
              projectId={route.id}
              {navigate}
              {replaceRoute}
              {readOnly}
            />
          {/if}
        </main>
      </div>
    </div>
  </div>

  <!-- The drawer home of the same nav body: vendored sheet, dark like the
       rail, Escape/overlay to close, ≥ 44 px rows. Mounted only while open. -->
  <Sheet.Root open={drawerOpen} onOpenChange={(next) => (drawerOpen = next)}>
    <Sheet.Content
      side="left"
      closeLabel={te('editor.io.close', language)}
      class="gap-0 border-r-0 bg-[#1b1b35] p-0 text-white data-[side=left]:w-[280px] data-[side=left]:sm:max-w-[280px] [&_[data-slot=sheet-close]]:min-h-11 [&_[data-slot=sheet-close]]:min-w-11 [&_[data-slot=sheet-close]]:text-white"
    >
      <Sheet.Title class="sr-only">{te('editor.nav.aria', language)}</Sheet.Title>
      <nav
        class="flex min-h-full flex-col overflow-y-auto pt-3.5 pb-4"
        aria-label={te('editor.nav.aria', language)}
      >
        {@render navBody(true)}
      </nav>
    </Sheet.Content>
  </Sheet.Root>

  {#if dialogTab && (!readOnly || dialogTab === 'export')}
    <ImportExportDialog
      {portfolio}
      {dispatch}
      {readOnly}
      tab={dialogTab}
      close={() => (dialogTab = undefined)}
      openSettings={() => {
        dialogTab = undefined
        navigate({ name: 'settings' })
      }}
    />
  {/if}
</div>

<!-- Outside `.editor` on purpose: the slideshow is a full-screen overlay, and
     the editor keeps its state untouched underneath until it comes back. -->
{#if slideshowAt !== undefined}
  <SlideshowHost {portfolio} startAt={slideshowAt} close={closeSlideshow} {exportStandalone} />
{/if}
