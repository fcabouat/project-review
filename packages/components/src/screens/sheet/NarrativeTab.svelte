<script lang="ts">
  /** Narrative tab of the project sheet: the done / ongoing / next lists with their parsed preview, plus the risks field. */
  import type { Project } from '@project-review/core/model/project'
  import { parseLine } from '@project-review/core/model/text-line'
  import { t } from '@project-review/core/services/i18n'
  import type { Language } from '@project-review/core/model/theme'
  import type { NarrativeList, ProjectScalarField } from '@project-review/core/events'
  import { te } from '../../i18n'
  import FieldText from '../../editor/FieldText.svelte'
  import type { Dispatch } from '../contracts'

  interface Props {
    readonly project: Project
    readonly language: Language
    readonly dispatch: Dispatch
    readonly set: <F extends ProjectScalarField>(field: F, after: Project[F]) => void
  }

  let { project, language, dispatch, set }: Props = $props()

  function setList(list: NarrativeList, text: string | undefined): void {
    const after = (text ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '')
    // Wholesale replacement: deep equality is the emitter's business.
    const before = project[list]
    if (before.length === after.length && before.every((l, i) => l === after[i])) return
    dispatch({ type: 'ChangeProjectList', id: project.id, list, after })
  }
</script>

<section class="card">
  <h2>{te('editor.sheet.narrative', language)}</h2>
  <div class="recit-grid">
    {#each ['done', 'ongoing', 'next'] as const as list (list)}
      <div class="recit-col">
        <FieldText
          {language}
          label={t(`sheet.${list}`, language)}
          value={project[list].join('\n')}
          rows={4}
          maxLines={5}
          hint={te('editor.hint.bullets', language)}
          commit={(v) => setList(list, v)}
        />
        {#if project[list].length > 0}
          <div class="preview">
            <span class="preview-label">{te('editor.sheet.preview', language)}</span>
            <ul class="preview-list">
              {#each project[list] as line, i (i)}
                {@const parsed = parseLine(line)}
                <li>
                  {#each parsed.segments as segment, j (j)}
                    {#if segment.bold}<b>{segment.text}</b>{:else}{segment.text}{/if}
                  {/each}
                  {#if parsed.suffix}<span class="muted-suffix"> — {parsed.suffix}</span>{/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div style="margin-top:16px">
    <FieldText
      {language}
      label={t('sheet.risks', language)}
      value={project.risks}
      rows={3}
      maxLines={3}
      hint={te('editor.hint.risks', language)}
      commit={(v) => set('risks', v)}
    />
  </div>
</section>
