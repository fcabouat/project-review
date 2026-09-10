<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  // The screen is normally mounted by the shell, which owns the stylesheet import.
  import '../../src/editor/editor.css'
  import SettingsScreen from '../../src/screens/SettingsScreen.svelte'
  import { sample } from '../commons/story-data'
  import { createScreenStore } from './screen-store.svelte'

  const { Story } = defineMeta({
    title: 'Screens/Settings',
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Identity, appearance, aggregate slides, categories, free slides, data administration. PLAYABLE on the in-memory loop; the local-save switch and the scheme picker are story-local mocks (no browser storage is touched — the scheme picker stamps the `dark` class exactly as the app does).',
        },
      },
    },
  })
</script>

<script lang="ts">
  const store = createScreenStore(sample)

  /** Story-local mock of the app's persistence control — flips, saves nothing;
   * with no storage behind it there is never a stored copy to arbitrate. */
  let persistEnabled = $state(true)
  const persistence = {
    get enabled() {
      return persistEnabled
    },
    lastError: null,
    toggle: (next: boolean) => {
      persistEnabled = next
    },
    pendingRestore: false,
    restore: () => {},
    keepOpen: () => {},
    dismissRestore: () => {},
  }

  /** Story-local mock of the app's appearance control — same contract, and it
   * stamps the `dark` class as the app's wiring does. */
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

<!-- The screen renders in a `.editor` root: the chrome stylesheet is scoped to it. -->
<Story name="Playable" asChild>
  <div class="editor" style="padding:24px">
    <SettingsScreen
      portfolio={store.present}
      dispatch={store.dispatch}
      {persistence}
      {appearance}
    />
  </div>
</Story>

<Story name="Without host-wired rows" asChild>
  <div class="editor" style="padding:24px">
    <SettingsScreen portfolio={store.present} dispatch={store.dispatch} />
  </div>
</Story>
