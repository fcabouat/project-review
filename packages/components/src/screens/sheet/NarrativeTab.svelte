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

  /**
   * THE TWO LINE BUDGETS, AND WHAT THEY ARE NOT. `5` for each narrative list
   * and `3` for the risks are an EDITORIAL guideline — what a review bullet
   * list should carry to stay readable on a slide read from across a room —
   * and NOT a frame measurement. No one ever grew a list until the card
   * clipped it, the way the character budgets of `model/budget.ts` were grown
   * (that is why they live in the core and these do not); the narrative card
   * renders every line it is given and hides the overflow.
   *
   * They are stated here rather than passed as bare numbers so the difference
   * is legible at the one place a reader would otherwise assume a measurement:
   * the MEASURED rule of this tab is `lineCapacity="narrativeLine"`, 110
   * characters per bullet, and the counts beside it are advice. Both are said
   * and neither refuses anything.
   */
  const BULLETS_ADVISED = 5
  const RISK_LINES_ADVISED = 3
</script>

<section class="bg-background border-border rounded-lg border p-4">
  <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
    {te('editor.sheet.narrative', language)}
  </h2>
  <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
    {#each ['done', 'ongoing', 'next'] as const as list (list)}
      <div>
        <FieldText
          {language}
          label={t(`sheet.${list}`, language)}
          draftKey={JSON.stringify(['project', project.id, list])}
          value={project[list].join('\n')}
          rows={4}
          maxLines={BULLETS_ADVISED}
          lineCapacity="narrativeLine"
          hint={te('editor.hint.bullets', language)}
          commit={(v) => setList(list, v)}
        />
        {#if project[list].length > 0}
          <div class="bg-secondary mt-0.5 rounded-md px-3 py-2.5">
            <span
              class="text-muted-foreground mb-[7px] block text-[10px] font-bold tracking-[0.05em] uppercase"
              >{te('editor.sheet.preview', language)}</span
            >
            <ul class="text-foreground m-0 list-disc pl-[15px] text-[13px]">
              {#each project[list] as line, i (i)}
                {@const parsed = parseLine(line)}
                <li class="mb-[5px] last:mb-0">
                  {#each parsed.segments as segment, j (j)}
                    {#if segment.bold}<b>{segment.text}</b>{:else}{segment.text}{/if}
                  {/each}
                  {#if parsed.suffix}<span class="text-muted-foreground font-normal">
                      — {parsed.suffix}</span
                    >{/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="mt-4">
    <FieldText
      {language}
      label={t('sheet.risks', language)}
      draftKey={JSON.stringify(['project', project.id, 'risks'])}
      value={project.risks}
      rows={3}
      maxLines={RISK_LINES_ADVISED}
      hint={te('editor.hint.risks', language)}
      commit={(v) => set('risks', v)}
    />
  </div>
</section>
