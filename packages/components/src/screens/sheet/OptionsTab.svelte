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
  <div class="flex flex-wrap items-start gap-[34px]">
    <FieldSegmented
      label={te('editor.field.sheet', language)}
      value={project.sheet}
      options={SHEET_MODES.map((mode) => ({
        value: mode,
        label: te(`editor.sheetMode.${mode}`, language),
      }))}
      hint={sheetHint}
      commit={(v: SheetMode) => set('sheet', v)}
    />
    <div class="flex w-[220px] flex-col">
      <FieldText
        {language}
        label={te('editor.field.author', language)}
        value={project.author}
        commit={(v) => set('author', v)}
      />
    </div>
    <div class="flex flex-col gap-[7px]">
      <span class="text-(--txt2) text-[12.5px] font-semibold"
        >{te('editor.field.updatedOn', language)}</span
      >
      <span class="text-(--txt2) flex h-9 items-center text-sm">
        {project.updatedOn ? formatShortDate(project.updatedOn) : t('priority.none', language)}
      </span>
    </div>
  </div>
  <p class="text-muted-foreground mt-3.5 text-[11.5px]">{sheetReason}</p>
</section>
