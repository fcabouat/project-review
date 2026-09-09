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

<section class="card">
  <h2>{te('editor.sheet.options', language)}</h2>
  <div class="options-row">
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
    <div class="field" style="width:220px;margin-bottom:0">
      <FieldText
        {language}
        label={te('editor.field.author', language)}
        value={project.author}
        max={40}
        commit={(v) => set('author', v)}
      />
    </div>
    <div class="field-group" style="margin-bottom:0">
      <span class="label">{te('editor.field.updatedOn', language)}</span>
      <span class="static-value">
        {project.updatedOn ? formatShortDate(project.updatedOn) : t('priority.none', language)}
      </span>
    </div>
  </div>
  <p class="hint" style="margin-top:14px">{sheetReason}</p>
</section>
