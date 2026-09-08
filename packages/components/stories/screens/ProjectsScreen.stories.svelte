<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  // The screen is normally mounted by the shell, which owns the stylesheet import.
  import '../../src/editor/editor.css'
  import ProjectsScreen from '../../src/screens/ProjectsScreen.svelte'
  import { sample } from '../commons/story-data'
  import { createScreenStore } from './screen-store.svelte'

  const { Story } = defineMeta({
    title: 'Screens/Projects',
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'E1/E1bis — the portfolio table, grouped by category, fuzzy search included. PLAYABLE: reorder, delete and add run real commands on the in-memory loop; `open` (the pencil) is inert here — the sheet is its own story.',
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
    <ProjectsScreen portfolio={store.present} dispatch={store.dispatch} open={() => {}} />
  </div>
</Story>
