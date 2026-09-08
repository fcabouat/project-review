<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  // The screen is normally mounted by the shell, which owns the stylesheet import.
  import '../../src/editor/editor.css'
  import ReviewScreen from '../../src/screens/ReviewScreen.svelte'
  import { sample } from '../commons/story-data'
  import { createScreenStore } from './screen-store.svelte'

  const { Story } = defineMeta({
    title: 'Screens/Review',
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'E0 — the review’s own fields and the opening free slides. PLAYABLE: the story binds the screen to an in-memory editing loop (`screen-store`), so every field commits a real command.',
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
    <ReviewScreen portfolio={store.present} dispatch={store.dispatch} />
  </div>
</Story>
