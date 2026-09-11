<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Shell from '../../src/screens/Shell.svelte'
  import type { Route } from '../../src/screens/contracts'
  import { sample } from '../commons/story-data'
  import { createScreenStore } from './screen-store.svelte'
  import { createPersistenceMock } from './persistence-mock.svelte'

  const { Story } = defineMeta({
    title: 'Screens/Shell',
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'The whole editor, PLAYABLE in Storybook: sidebar, top bar, the five screens behind an in-memory route (the sidebar links call `navigate`, no hash is touched), undo/redo, import/export, slideshow. The top bar carries two compact dropdown menus: the language menu (FR/EN trigger) dispatches the same `ChangeSetting` command as Settings — pick a language and the whole shell relabels (undoable, like any edit) — and the scheme menu (sun/moon trigger following the EFFECTIVE scheme) drives the same `AppearanceControl` as Settings ▸ Appearance, here a story-local mock that stamps the `dark` class exactly as the app does. The review date lives with the review data, on the Review screen. Below the `lg` breakpoint the sidebar becomes the vendored sheet drawer behind the hamburger — narrow the canvas to play it. The « Enregistrer » export button is inert — the standalone export is the app’s injection.',
        },
      },
    },
  })
</script>

<script lang="ts">
  const store = createScreenStore(sample)

  // The story's router: one reactive cell instead of location.hash — exactly
  // what the shell's route/navigate props exist for.
  let route = $state<Route>({ name: 'review' })
  const navigate = (next: Route): void => {
    route = next
  }

  /** One mock per story: the save-state strip under the top bar is what each
   * of the three below is actually about. */
  const persistence = createPersistenceMock()
  const refused = createPersistenceMock({ revision: 12, phase: 'error' })
  const contended = createPersistenceMock({ revision: 12, phase: 'conflict' })
  const storageless = createPersistenceMock({ revision: 0, phase: 'unavailable' }, false)

  /** Story-local mock of the app's appearance control: same contract, and it
   * stamps the `dark` class exactly as the app's wiring does (`system` reads
   * the OS preference once per change — enough for a story). */
  let scheme = $state<'system' | 'light' | 'dark'>('light')
  const appearance = {
    get scheme() {
      return scheme
    },
    setScheme: (next: 'system' | 'light' | 'dark') => {
      scheme = next
      const dark =
        next === 'dark' ||
        (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
    },
  }
</script>

<Story name="Playable" asChild>
  <Shell
    portfolio={store.present}
    past={store.past}
    future={store.future}
    canUndo={store.canUndo}
    canRedo={store.canRedo}
    dispatch={store.dispatch}
    undo={store.undo}
    redo={store.redo}
    {route}
    {navigate}
    replaceRoute={navigate}
    {persistence}
    {appearance}
  />
</Story>

<!-- The write the storage refused. The strip is the ONLY thing standing
     between the user and a silent loss at the next reload: it says what
     happened and offers the one action that saves the work — download a
     copy. Never a toast, never a line in a settings card. -->
<Story name="Local save refused" asChild>
  <Shell
    portfolio={store.present}
    past={store.past}
    future={store.future}
    canUndo={store.canUndo}
    canRedo={store.canRedo}
    dispatch={store.dispatch}
    undo={store.undo}
    redo={store.redo}
    {route}
    {navigate}
    replaceRoute={navigate}
    persistence={refused}
    {appearance}
  />
</Story>

<!-- Another tab saved over the copy this one was working from. Nothing was
     overwritten; the two answers are the only honest ones, and clicking
     either settles the strip back to « saved » here. -->
<Story name="Conflict with another tab" asChild>
  <Shell
    portfolio={store.present}
    past={store.past}
    future={store.future}
    canUndo={store.canUndo}
    canRedo={store.canRedo}
    dispatch={store.dispatch}
    undo={store.undo}
    redo={store.redo}
    {route}
    {navigate}
    replaceRoute={navigate}
    persistence={contended}
    {appearance}
  />
</Story>

<!-- The browser offers no storage at all (blocked third-party storage, a
     restricted context). The editor mounts and works exactly as ever — only
     the saving cannot happen, and it is said from the first second instead of
     discovered at the next reload. Settings ▸ Data disables the switch and
     states the reason there too. -->
<Story name="No storage in this browser" asChild>
  <Shell
    portfolio={store.present}
    past={store.past}
    future={store.future}
    canUndo={store.canUndo}
    canRedo={store.canRedo}
    dispatch={store.dispatch}
    undo={store.undo}
    redo={store.redo}
    route={{ name: 'settings' }}
    {navigate}
    replaceRoute={navigate}
    persistence={storageless}
    {appearance}
  />
</Story>
