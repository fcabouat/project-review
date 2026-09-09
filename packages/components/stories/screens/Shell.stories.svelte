<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Shell from '../../src/screens/Shell.svelte'
  import type { Route } from '../../src/screens/contracts'
  import { sample } from '../commons/story-data'
  import { createScreenStore } from './screen-store.svelte'

  const { Story } = defineMeta({
    title: 'Screens/Shell',
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'The whole editor, PLAYABLE in Storybook: sidebar, top bar, the five screens behind an in-memory route (the sidebar links call `navigate`, no hash is touched), undo/redo, import/export, slideshow. The top bar’s FR | EN switch dispatches the same `ChangeSetting` command as Settings — click it and the whole shell relabels (undoable, like any edit). Its neighbour, the scheme toggle (Système/Clair/Sombre), drives the same `AppearanceControl` as Settings ▸ Appearance — here a story-local mock that stamps the `dark` class exactly as the app does. Below the `lg` breakpoint the sidebar becomes the vendored sheet drawer behind the hamburger — narrow the canvas to play it. The « Enregistrer » export button is inert — the standalone export is the app’s injection.',
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

  /** Story-local mock of the app's persistence control — flips, saves nothing. */
  let persistEnabled = $state(true)
  const persistence = {
    get enabled() {
      return persistEnabled
    },
    lastError: null,
    toggle: (next: boolean) => {
      persistEnabled = next
    },
  }

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
