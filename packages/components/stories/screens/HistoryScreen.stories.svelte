<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  // The screen is normally mounted by the shell, which owns the stylesheet import.
  import '../../src/editor/editor.css'
  import HistoryScreen from '../../src/screens/HistoryScreen.svelte'
  import { sample } from '../commons/story-data'
  import { createScreenStore } from './screen-store.svelte'

  const { Story } = defineMeta({
    title: 'Screens/History',
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'The event journal, most recent first, with the current-position separator. PLAYABLE: the story pre-runs a few real commands (one already undone), and the two buttons move the cursor on the in-memory loop.',
        },
      },
    },
  })
</script>

<script lang="ts">
  const store = createScreenStore(sample)
  // A journal worth reading: three real edits, the last one already undone.
  store.dispatch({ type: 'ChangeReviewField', field: 'title', after: 'Revue de septembre' })
  store.dispatch({ type: 'RenameCategory', id: sample.categories[0]!.id, after: 'Cat. renommée' })
  store.dispatch({ type: 'ChangeSetting', setting: 'recapRows', after: 12 })
  store.undo()
</script>

<!-- The screen renders in a `.editor` root: the chrome stylesheet is scoped to it. -->
<Story name="Playable" asChild>
  <div class="editor" style="padding:24px">
    <HistoryScreen
      portfolio={store.present}
      past={store.past}
      future={store.future}
      undo={store.undo}
      redo={store.redo}
    />
  </div>
</Story>
