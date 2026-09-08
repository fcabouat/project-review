<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  // The dialog is normally mounted by a view, which owns the stylesheet import.
  import '../../src/editor/editor.css'
  import SlidePreviewDialog from '../../src/editor/SlidePreviewDialog.svelte'
  import { sample as samplePortfolio } from '../commons/story-data'
  import { te } from '../../src/i18n'
  import { categoryOf } from '@project-review/core/projections'

  const language = samplePortfolio.settings.language
  const infra = categoryOf(samplePortfolio, 'infra')

  const { Story } = defineMeta({
    title: 'Editor/Slide preview',
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'E2ter — one slide, rendered by the real `SlideView` at 0.62 on the dark stage. The component is mounted only while the preview is open, so a closed preview renders exactly zero slides in the background; the deck position in the header comes from the same `deck()` as every other counter.',
        },
      },
    },
  })
</script>

<!-- The sheet of the project being edited: the E2ter frame of the mockup. -->
<Story name="Project sheet" asChild>
  <div class="editor">
    <SlidePreviewDialog
      portfolio={samplePortfolio}
      slide={{ type: 'sheet', projectId: 'P-04' }}
      subject={te('editor.preview.subject.sheet', language, { id: 'P-04' })}
      close={() => {}}
    />
  </div>
</Story>

<!-- The divider of a category, previewed from the Settings screen. -->
<Story name="Category divider" asChild>
  <div class="editor">
    <SlidePreviewDialog
      portfolio={samplePortfolio}
      slide={{ type: 'divider', categoryId: 'infra', number: 2 }}
      subject={te('editor.preview.subject.divider', language, { name: infra.name })}
      close={() => {}}
    />
  </div>
</Story>

<!-- The title slide, previewed from the Review screen. -->
<Story name="Title slide" asChild>
  <div class="editor">
    <SlidePreviewDialog
      portfolio={samplePortfolio}
      slide={{ type: 'title' }}
      subject={te('editor.preview.subject.title', language)}
      close={() => {}}
    />
  </div>
</Story>
