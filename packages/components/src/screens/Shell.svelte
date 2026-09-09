<script lang="ts">
  /**
   * Application shell: dark full-height sidebar, light
   * top bar, and one screen per route — `#/review`, `#/projects`, `#/sheet/{id}`,
   * `#/settings`, `#/history`.
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
   */
  import '../editor/editor.css'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { DomainEvent } from '@project-review/core/events'
  import { deck, isArchived, isTracked } from '@project-review/core/projections'
  import { LANGUAGES } from '@project-review/core/model/theme'
  import { formatShortDate } from '@project-review/core/services/i18n'
  import { te } from '../i18n'
  import { identityLine } from '../commons/identity-line'
  import { Badge } from '../commons/ui/badge'
  import { Button } from '../commons/ui/button'
  import { Input } from '../commons/ui/input'
  import { Separator } from '../commons/ui/separator'
  import ImportExportDialog from '../editor/ImportExportDialog.svelte'
  import SlideshowHost, { provideSlideshow } from '../slideshow/SlideshowHost.svelte'
  import type { Dispatch, PersistenceControl, Route } from './contracts'
  import ReviewScreen from './ReviewScreen.svelte'
  import ProjectsScreen from './ProjectsScreen.svelte'
  import SettingsScreen from './SettingsScreen.svelte'
  import SheetScreen from './SheetScreen.svelte'
  import HistoryScreen from './HistoryScreen.svelte'

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
    /** Replaces the current entry — redirects (unknown sheet id, renumbering). */
    readonly replaceRoute: (route: Route) => void
    /** Local-save switch (Settings ▸ Data); absent → the row is not shown. */
    readonly persistence?: PersistenceControl
    /**
     * « Enregistrer » — the standalone .html. Injected by the app
     * (infrastructure's dom-export, reveal options bound); layering forbids
     * the reverse import. Absent — a story — the button is a no-op.
     */
    readonly exportStandalone?: (slidesEl: HTMLElement, portfolio: Portfolio) => Promise<void>
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
    exportStandalone,
  }: Props = $props()

  let dialogTab = $state<'export' | 'import' | undefined>(undefined)
  let navCollapsed = $state(false)
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

  const language = $derived(portfolio.settings.language)
  const trackedCount = $derived(portfolio.projects.filter(isTracked).length)
  const archivedCount = $derived(portfolio.projects.filter(isArchived).length)
  const slideCount = $derived(deck(portfolio).length)
  /** Blank-identity grace: filled parts only — empty until the user types theirs. */
  const entity = $derived(
    identityLine(' · ', portfolio.settings.identity.org, portfolio.settings.identity.unit),
  )
  const initial = $derived(portfolio.review.title.trim().slice(0, 1).toUpperCase() || 'R')

  /** Real href for accessibility, `navigate` for the actual move. */
  function follow(event: MouseEvent, next: Route): void {
    event.preventDefault()
    navigate(next)
  }

  /** Ctrl+Z / Ctrl+Y, as the History footer promises — but never inside a field. */
  function onkeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return
    const key = event.key.toLowerCase()
    if (key !== 'z' && key !== 'y') return
    const target = event.target as HTMLElement | null
    if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return
    event.preventDefault()
    if (key === 'y' || event.shiftKey) redo()
    else undo()
  }

  const NAV_ITEM =
    'flex h-9 w-full cursor-pointer items-center gap-2 border-l-[3px] border-transparent px-[18px] ' +
    'text-left text-[13.5px] font-semibold text-white/70 no-underline hover:bg-white/5 ' +
    'hover:text-white focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring'
  const NAV_ITEM_ACTIVE =
    'border-l-(--accent-main) bg-(--accent-main)/20 font-bold text-white ' +
    'flex h-9 w-full cursor-pointer items-center gap-2 border-l-[3px] px-[18px] ' +
    'text-left text-[13.5px] no-underline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring'
</script>

<svelte:window {onkeydown} />

<div class="editor">
  <div class="bg-secondary min-h-screen">
    <div class="flex min-h-screen items-stretch">
      <nav
        class={navCollapsed
          ? 'w-0 flex-[0_0_0px] overflow-hidden p-0'
          : 'flex w-[216px] flex-[0_0_216px] flex-col bg-[#1b1b35] pt-3.5 pb-4'}
        aria-label={te('editor.nav.aria', language)}
      >
        <div class="flex items-center gap-2.5 px-3.5 pt-1 pb-4">
          <span
            class="bg-(--accent-main) grid size-9 flex-none place-items-center rounded-[10px] text-[15px] font-extrabold text-white"
            aria-hidden="true">{initial}</span
          >
          <span>
            <b class="block text-sm leading-[1.2] font-extrabold tracking-[-0.01em] text-white"
              >{portfolio.review.title}</b
            >{#if entity}<span
                class="mt-0.5 block text-[10.5px] leading-none font-semibold text-white/55"
                >{entity}</span
              >{/if}
          </span>
        </div>

        <!-- One anchor shape for the four routes; `activeOn` widens the
             highlight where a route covers a sub-route (projects → sheet). -->
        {#snippet navLink(target: Route, activeOn: readonly Route['name'][], label: string)}
          {@const active = activeOn.includes(route.name)}
          <a
            class={active ? NAV_ITEM_ACTIVE : NAV_ITEM}
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
          <span
            class="mb-1.5 px-[18px] text-[10.5px] font-bold tracking-[0.06em] text-white/40 uppercase"
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
          <span
            class="mb-1.5 px-[18px] text-[10.5px] font-bold tracking-[0.06em] text-white/40 uppercase"
            >{te('editor.nav.data', language)}</span
          >
          <button type="button" class={NAV_ITEM} onclick={() => (dialogTab = 'import')}>
            {te('editor.nav.import', language)}
          </button>
          <button type="button" class={NAV_ITEM} onclick={() => (dialogTab = 'export')}>
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
          <div class="text-[10px] leading-[1.55] font-medium text-white/40">
            {te('editor.about.built', language)}<br />
            {te('editor.about.author', language)}<br />
            <span class="text-white/30">{te('editor.about.mail', language)}</span>
          </div>
        </div>
      </nav>

      <div class="flex min-w-0 flex-1 flex-col">
        <div
          class="border-border flex h-[60px] flex-none items-center justify-between gap-5 border-b bg-white px-[22px]"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground"
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

          <div class="flex items-center gap-2.5">
            <label class="flex items-center gap-2">
              <span class="text-muted-foreground text-xs font-semibold whitespace-nowrap"
                >{te('editor.field.reviewDate', language)}</span
              >
              <Input
                class="read-only:text-(--txt2) w-[118px] text-center read-only:bg-[#fafafa]"
                value={formatShortDate(portfolio.review.reviewDate)}
                readonly
              />
            </label>
            <Separator orientation="vertical" class="h-[22px] min-h-0 self-center" />
            <!-- Native language switch: the same `ChangeSetting` command as
                 Settings ▸ Language — undoable, and every label of the shell
                 re-derives from `portfolio.settings.language` on the spot. -->
            <div
              class="border-input inline-flex overflow-hidden rounded-md border bg-white"
              role="group"
              aria-label={te('editor.topbar.language', language)}
            >
              {#each LANGUAGES as candidate (candidate)}
                <button
                  type="button"
                  class="border-input text-(--txt2) aria-pressed:bg-accent aria-pressed:text-accent-foreground focus-visible:outline-ring cursor-pointer border-r bg-white px-[11px] py-[7px] text-xs whitespace-nowrap last:border-r-0 focus-visible:-outline-offset-2 focus-visible:outline-2 aria-pressed:font-bold"
                  aria-pressed={language === candidate}
                  onclick={() =>
                    dispatch({ type: 'ChangeSetting', setting: 'language', after: candidate })}
                >
                  {candidate.toUpperCase()}
                </button>
              {/each}
            </div>
            <Separator orientation="vertical" class="h-[22px] min-h-0 self-center" />
            <span class="relative inline-flex">
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground"
                title={te('editor.topbar.undo', language)}
                aria-label={te('editor.topbar.undo', language)}
                disabled={!canUndo}
                onclick={() => undo()}
              >
                ↶
              </Button>
              {#if past.length > 0}<Badge
                  class="bg-foreground absolute -top-1 -right-1.5 h-4 min-w-4 px-1 text-[9.5px] font-bold text-white"
                  >{past.length}</Badge
                >{/if}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-muted-foreground"
              title={te('editor.topbar.redo', language)}
              aria-label={te('editor.topbar.redo', language)}
              disabled={!canRedo}
              onclick={() => redo()}
            >
              ↷
            </Button>
            <Separator orientation="vertical" class="h-[22px] min-h-0 self-center" />
            <!-- Mounts the slideshow ON CLICK, never before: reveal.js is not part
                 of the editor's bundle and is fetched here. -->
            <Button
              title={te('editor.topbar.openSlideshow', language)}
              onclick={() => (slideshowAt = 0)}
            >
              {te('editor.topbar.slideshow', language)}
            </Button>
          </div>
        </div>

        <div class="min-h-0 min-w-0 flex-1 p-5">
          {#if route.name === 'review'}
            <ReviewScreen {portfolio} {dispatch} />
          {:else if route.name === 'projects'}
            <ProjectsScreen {portfolio} {dispatch} open={(id) => navigate({ name: 'sheet', id })} />
          {:else if route.name === 'settings'}
            <SettingsScreen {portfolio} {dispatch} {persistence} />
          {:else if route.name === 'history'}
            <HistoryScreen {portfolio} {past} {future} {undo} {redo} />
          {:else if route.name === 'sheet'}
            <SheetScreen {portfolio} {dispatch} projectId={route.id} {navigate} {replaceRoute} />
          {/if}
        </div>
      </div>
    </div>
  </div>

  {#if dialogTab}
    <ImportExportDialog
      {portfolio}
      {dispatch}
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
  <SlideshowHost
    {portfolio}
    startAt={slideshowAt}
    close={() => (slideshowAt = undefined)}
    {exportStandalone}
  />
{/if}
