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
            'E0b — identity, appearance, aggregate slides, categories, free slides, data administration. PLAYABLE on the in-memory loop; the local-save switch is a story-local mock (no browser storage is touched).',
        },
      },
    },
  })
</script>

<script lang="ts">
  const store = createScreenStore(sample)

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
</script>

<!-- The screen renders in a `.editor` root: the chrome stylesheet is scoped to it. -->
<Story name="Playable" asChild>
  <div class="editor" style="padding:24px">
    <SettingsScreen portfolio={store.present} dispatch={store.dispatch} {persistence} />
  </div>
</Story>

<Story name="Without local-save row" asChild>
  <div class="editor" style="padding:24px">
    <SettingsScreen portfolio={store.present} dispatch={store.dispatch} />
  </div>
</Story>
