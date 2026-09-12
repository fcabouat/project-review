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
            'Import / export modal — export serialises the portfolio (whole, or a partial file from the category-grouped checkboxes); import runs the total parse and shows its report before anything happens. The action is a single command either way — `ReplacePortfolio` or, in merge mode, `MergeProjects` — so it undoes like a typo.',
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

<!-- Merge mode with a parsed contribution: the mode choice, the NOMINAL list
     of the projects the file would replace (id · present name, read off the
     decided event's before side), the derived preview ("merge: 2 replaced,
     1 added") and the undoable hint, all visible BEFORE anything is
     dispatched. -->
<Story name="Import — fusion" asChild>
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

<!-- THE REFUSAL THE FILE ITSELF DOES NOT EXPLAIN: the report says the file is
     valid (it is), and the line under the preview says the import would record
     nothing all the same — the portfolio it would produce is past the entity
     ceiling. The confirm button is out, and the dialog stays. -->
<Story name="Import — refus du budget" asChild>
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
