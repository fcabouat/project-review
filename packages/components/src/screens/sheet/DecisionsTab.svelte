<script lang="ts">
  /** Decisions tab of the project sheet: up to three decision cards, each with its question, decider, and settled outcome. */
  import type { Decision, Project } from '@project-review/core/model/project'
  import { isoDate } from '@project-review/core/values/date'
  import type { Language } from '@project-review/core/model/theme'
  import { te } from '../../i18n'
  import FieldText from '../../editor/FieldText.svelte'
  import type { Dispatch } from '../contracts'

  interface Props {
    readonly project: Project
    readonly language: Language
    readonly dispatch: Dispatch
  }

  let { project, language, dispatch }: Props = $props()

  function setDecisions(after: readonly Decision[]): void {
    dispatch({ type: 'ChangeProjectDecisions', id: project.id, after })
  }

  function patchDecision(index: number, patch: Partial<Decision>): void {
    setDecisions(project.decisions.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  /** `taken` is present or absent — never `{ text: '', when: '' }`:
   * the outcome settles only once BOTH the text and a valid date are there. */
  function patchOutcome(index: number, patch: { text?: string; when?: string }): void {
    const current = project.decisions[index]
    if (!current) return
    const text = patch.text ?? current.taken?.text ?? ''
    const when = isoDate(patch.when ?? current.taken?.when ?? '')
    const taken = text !== '' && when !== undefined ? { text, when } : undefined
    setDecisions(project.decisions.map((d, i) => (i === index ? { ...d, taken } : d)))
  }
</script>

<section class="card">
  <h2>{te('editor.tab.decisions', language)}</h2>
  {#each project.decisions as decision, index (index)}
    <div class="decision-card">
      <div class="decision-card-head">
        <span class="decision-index">
          {te('editor.sheet.decisionIndex', language, { n: index + 1 })}
        </span>
        <button
          class="icon-btn"
          type="button"
          title={te('editor.sheet.removeDecision', language)}
          aria-label={te('editor.sheet.removeDecision', language)}
          onclick={() => setDecisions(project.decisions.filter((_, i) => i !== index))}>✕</button
        >
      </div>
      <FieldText
        {language}
        label={te('editor.sheet.question', language)}
        value={decision.question}
        rows={2}
        max={160}
        hint={te('editor.hint.question', language)}
        commit={(v) => patchDecision(index, { question: v ?? decision.question })}
      />
      <FieldText
        {language}
        label={te('editor.sheet.decider', language)}
        value={decision.decider}
        max={40}
        hint={te('editor.hint.decider', language)}
        commit={(v) => patchDecision(index, { decider: v })}
      />
      <div class="decision-taken">
        <span class="decision-taken-label">{te('editor.sheet.taken', language)}</span>
        <div class="grid-2-1">
          <FieldText
            {language}
            label={te('editor.sheet.takenText', language)}
            value={decision.taken?.text}
            max={160}
            placeholder="—"
            commit={(v) => patchOutcome(index, { text: v ?? '' })}
          />
          <FieldText
            {language}
            label={te('editor.sheet.takenWhen', language)}
            value={decision.taken?.when}
            placeholder={te('editor.review.dateHint', language)}
            commit={(v) => patchOutcome(index, { when: v ?? '' })}
          />
        </div>
      </div>
    </div>
  {:else}
    <p class="hint">{te('editor.sheet.noDecision', language)}</p>
  {/each}

  {#if project.decisions.length < 3}
    <button
      class="btn btn-secondary btn-sm"
      type="button"
      style="margin-top:12px"
      onclick={() => setDecisions([...project.decisions, { question: '' }])}
    >
      {te('editor.sheet.addDecision', language, { n: 3 - project.decisions.length })}
    </button>
  {:else}
    <p class="hint" style="margin-top:12px">{te('editor.sheet.decisionsFull', language)}</p>
  {/if}
</section>
