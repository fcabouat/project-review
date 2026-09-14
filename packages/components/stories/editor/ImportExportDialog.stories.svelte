<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  // The dialog is normally mounted by the shell, which owns the stylesheet import.
  import '../../src/editor/editor.css'
  import ImportExportDialog from '../../src/editor/ImportExportDialog.svelte'
  import {
    partialPortfolio,
    serializePortfolio,
  } from '@project-review/core/services/portfolio-json'
  import { MAX_ENTITIES, entityCount } from '@project-review/core/model/budget'
  import type { Project } from '@project-review/core/model/project'
  import { NO_CATEGORY, projectId } from '@project-review/core/values/ids'
  import { sample } from '../commons/story-data'

  const { Story } = defineMeta({
    title: 'Editor/Import & export',
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Export a full portfolio, selected projects or an appearance profile. Import restores the complete file or mixes explicitly selected settings and items, with an additions/conflicts preview. Both modes apply one undoable ReplacePortfolio command.',
        },
      },
    },
  })

  const p1 = sample.projects[0]!
  const p2 = sample.projects[1]!
  /** A colleague's contribution: their two projects (one reworked) plus a new
   * one — enough for the merge preview to show replaced AND added figures. */
  const contribution = serializePortfolio({
    ...partialPortfolio(sample, new Set([String(p1.id), String(p2.id)])),
    projects: [
      { ...p1, goal: 'Objectif retravaillé par le collègue.' },
      p2,
      { ...p2, id: projectId('P-77')!, name: 'Projet apporté par le collègue' },
    ],
  })

  /** The smallest project the format accepts — filler for the file below, and
   * nothing else: what that story is about is the COUNT. */
  const filler = (i: number): Project => ({
    id: projectId(`X-${i}`)!,
    name: `Projet ${i}`,
    categoryId: NO_CATEGORY,
    stage: 'toScope',
    onHold: false,
    goal: '',
    done: [],
    ongoing: [],
    next: [],
    decisions: [],
    milestones: [],
    sheet: 'auto',
  })

  /** A contribution that is a perfectly legal file ON ITS OWN — under every
   * ceiling — and whose merge into the present portfolio would cross the
   * entity one by a single project. */
  const overBudget = serializePortfolio({
    ...sample,
    categories: [],
    freeSlides: [],
    projects: Array.from({ length: MAX_ENTITIES - entityCount(sample) + 1 }, (_, i) => filler(i)),
  })
</script>

<!-- The modal renders in a `.editor` root: the chrome stylesheet is scoped to
     it. `openSettings` is a no-op seam here: it only has to make the
     Settings ▸ Data pointer line visible. -->
<Story name="Export" asChild>
  <div class="editor">
    <ImportExportDialog
      portfolio={sample}
      dispatch={() => {}}
      tab="export"
      close={() => {}}
      openSettings={() => {}}
    />
  </div>
</Story>

<Story name="Import" asChild>
  <div class="editor">
    <ImportExportDialog
      portfolio={sample}
      dispatch={() => {}}
      tab="import"
      close={() => {}}
      openSettings={() => {}}
    />
  </div>
</Story>

<!-- No selection is implicit: choose settings/items to inspect their effect. -->
<Story name="Import — panachage" asChild>
  <div class="editor">
    <ImportExportDialog
      portfolio={sample}
      dispatch={() => {}}
      tab="import"
      prefill={contribution}
      prefillMode="merge"
      close={() => {}}
      openSettings={() => {}}
    />
  </div>
</Story>

<!-- Selecting all incoming projects crosses the merged portfolio's budget;
     the source file alone is valid. The preview must then refuse the action. -->
<Story name="Import — sélection au plafond" asChild>
  <div class="editor">
    <ImportExportDialog
      portfolio={sample}
      dispatch={() => {}}
      tab="import"
      prefill={overBudget}
      prefillMode="merge"
      close={() => {}}
      openSettings={() => {}}
    />
  </div>
</Story>
