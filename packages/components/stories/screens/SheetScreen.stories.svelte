<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  // The screen is normally mounted by the shell, which owns the stylesheet import.
  import '../../src/editor/editor.css'
  import SheetScreen from '../../src/screens/SheetScreen.svelte'
  import { sample } from '../commons/story-data'
  import { createScreenStore } from './screen-store.svelte'

  const { Story } = defineMeta({
    title: 'Screens/Sheet',
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'E2 — the project sheet in five tabs. PLAYABLE: every field commits a real command on the in-memory loop (renumbering included — `decide` refuses a taken id). The two navigation callbacks are inert here; the full flow lives in the Shell story.',
        },
      },
    },
  })
</script>

<script lang="ts">
  const store = createScreenStore(sample)
</script>

<!-- The screen renders in a `.editor` root: the chrome stylesheet is scoped to it. -->
<Story name="Playable" asChild>
  <div class="editor" style="padding:24px">
    <SheetScreen
      portfolio={store.present}
      dispatch={store.dispatch}
      projectId="P-01"
      navigate={() => {}}
      replaceRoute={() => {}}
    />
  </div>
</Story>
