<script lang="ts">
  /** Options tab of the project sheet: the sheet display mode with the live reason it shows, the author, and the last-update date. */
  import type { Project, SheetMode } from '@project-review/core/model/project'
  import { SHEET_MODES } from '@project-review/core/model/project'
  import { showsSheet } from '@project-review/core/projections'
  import { formatShortDate, t } from '@project-review/core/services/i18n'
  import type { Language } from '@project-review/core/model/theme'
  import type { ProjectScalarField } from '@project-review/core/events'
  import { te } from '../../i18n'
  import FieldText from '../../editor/FieldText.svelte'
  import FieldSegmented from '../../editor/FieldSegmented.svelte'

  interface Props {
    readonly project: Project
    readonly language: Language
    readonly set: <F extends ProjectScalarField>(field: F, after: Project[F]) => void
  }

  let { project, language, set }: Props = $props()

  const sheetHint = $derived(te(`editor.hint.sheet.${project.sheet}`, language))

  /**
   * TRUE cause of the sheet's presence, mirror of `showsSheet` cause by cause:
   * forced mode, then stage, then pending decision. The stage case is told
   * apart by PROBING the same predicate on a decision-less copy rather than by
   * restating its stage list here.
   */
  const sheetReason = $derived.by(() => {
    if (!showsSheet(project)) return te('editor.reason.hidden', language)
    if (project.sheet === 'always') return te('editor.reason.shownAlways', language)
    if (showsSheet({ ...project, decisions: [] }))
      return te('editor.reason.shownStage', language, {
        stage: t(`stage.${project.stage}`, language),
      })
    return te('editor.reason.shownDecision', language)
  })
</script>

<section class="bg-background border-border rounded-lg border p-4">
  <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
    {te('editor.sheet.options', language)}
  </h2>
  <div class="grid min-w-0 gap-5">
    <FieldSegmented
      label={te('editor.field.sheet', language)}
      value={project.sheet}
      options={SHEET_MODES.map((mode) => ({
        value: mode,
        label: te(`editor.sheetMode.${mode}.label`, language),
      }))}
      hint={sheetHint}
      commit={(v: SheetMode) => set('sheet', v)}
    />
    <div class="flex w-full max-w-[320px] flex-col">
      <FieldText
        {language}
        label={te('editor.field.author', language)}
        draftKey={JSON.stringify(['project', project.id, 'author'])}
        value={project.author}
        commit={(v) => set('author', v)}
      />
    </div>
  </div>
  <p class="text-muted-foreground mt-3.5 text-[11.5px]">{sheetReason}</p>
  <details class="text-muted-foreground mt-4 text-xs">
    <summary class="cursor-pointer">{te('editor.metadata.title', language)}</summary>
    <dl class="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <dt class="font-semibold">{te('editor.identity.title', language)}</dt>
        <dd class="mt-1"><code class="select-all break-all">{project.id}</code></dd>
      </div>
      <div>
        <dt class="font-semibold">{te('editor.field.updatedOn', language)}</dt>
        <dd class="mt-1">
          {project.updatedOn ? formatShortDate(project.updatedOn) : t('priority.none', language)}
        </dd>
      </div>
    </dl>
    <p class="mt-2">{te('editor.identity.hint', language)}</p>
  </details>
</section>
