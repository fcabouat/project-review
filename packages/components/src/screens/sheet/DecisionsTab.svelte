<script lang="ts">
  /** Decisions tab of the project sheet: up to three decision cards, each with its question, decider, and settled outcome. */
  import type { Decision, Project } from '@project-review/core/model/project'
  import { isoDate } from '@project-review/core/values/date'
  import type { Language } from '@project-review/core/model/theme'
  import { te } from '../../i18n'
  import FieldText from '../../editor/FieldText.svelte'
  import Icon from '../../commons/Icon.svelte'
  import { Button } from '../../commons/ui/button'
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

  /** Refusal line of the outcome date, per decision index — a date the format
   * refuses is SAID, not swallowed into a silently unsettled outcome. */
  let whenErrors = $state<Record<number, string | undefined>>({})

  /** `taken` is present or absent — never `{ text: '', when: '' }`:
   * the outcome settles only once BOTH the text and a valid date are there. */
  function patchOutcome(index: number, patch: { text?: string; when?: string }): void {
    const current = project.decisions[index]
    if (!current) return
    const text = patch.text ?? current.taken?.text ?? ''
    const rawWhen = patch.when ?? current.taken?.when ?? ''
    const when = isoDate(rawWhen)
    // A non-empty date the calendar refuses is a mistake to show, not a
    // reason to quietly unsettle the decision (same wording as the parse).
    if (rawWhen !== '' && when === undefined) {
      whenErrors = {
        ...whenErrors,
        [index]: te('editor.error.invalidDate', language, { value: rawWhen }),
      }
      return
    }
    whenErrors = { ...whenErrors, [index]: undefined }
    const taken = text !== '' && when !== undefined ? { text, when } : undefined
    setDecisions(project.decisions.map((d, i) => (i === index ? { ...d, taken } : d)))
  }
</script>

<section class="bg-background border-border rounded-lg border p-4">
  <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
    {te('editor.tab.decisions', language)}
  </h2>
  {#each project.decisions as decision, index (index)}
    <div class="border-border mb-3.5 rounded-lg border px-4 py-3.5 last-of-type:mb-0">
      <div class="mb-1.5 flex items-center justify-between">
        <span class="text-muted-foreground text-[11px] font-bold tracking-[0.05em] uppercase">
          {te('editor.sheet.decisionIndex', language, { n: index + 1 })}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          class="text-muted-foreground"
          title={te('editor.sheet.removeDecision', language)}
          aria-label={te('editor.sheet.removeDecision', language)}
          onclick={() => setDecisions(project.decisions.filter((_, i) => i !== index))}
          ><Icon name="close-line" /></Button
        >
      </div>
      <FieldText
        {language}
        label={te('editor.sheet.question', language)}
        value={decision.question}
        rows={2}
        capacity="decisionQuestion"
        hint={te('editor.hint.question', language)}
        commit={(v) => patchDecision(index, { question: v ?? decision.question })}
      />
      <FieldText
        {language}
        label={te('editor.sheet.decider', language)}
        value={decision.decider}
        capacity="decisionDecider"
        hint={te('editor.hint.decider', language)}
        commit={(v) => patchDecision(index, { decider: v })}
      />
      <div
        class="bg-secondary mt-2 rounded-md border border-dashed border-[#c7c7cc] p-3 dark:border-(--border)"
      >
        <span
          class="text-muted-foreground mb-[9px] block text-[10px] font-bold tracking-[0.05em] uppercase"
          >{te('editor.sheet.taken', language)}</span
        >
        <div class="grid grid-cols-[2fr_1fr] gap-3.5 max-md:grid-cols-1">
          <FieldText
            {language}
            label={te('editor.sheet.takenText', language)}
            value={decision.taken?.text}
            placeholder="—"
            commit={(v) => patchOutcome(index, { text: v ?? '' })}
          />
          <FieldText
            {language}
            label={te('editor.sheet.takenWhen', language)}
            value={decision.taken?.when}
            placeholder={te('editor.review.dateHint', language)}
            error={whenErrors[index]}
            commit={(v) => patchOutcome(index, { when: v ?? '' })}
          />
        </div>
      </div>
    </div>
  {:else}
    <p class="text-muted-foreground text-[11.5px]">{te('editor.sheet.noDecision', language)}</p>
  {/each}

  {#if project.decisions.length < 3}
    <Button
      variant="outline"
      size="sm"
      class="mt-3"
      onclick={() => setDecisions([...project.decisions, { question: '' }])}
    >
      {te('editor.sheet.addDecision', language, { n: 3 - project.decisions.length })}
    </Button>
  {:else}
    <p class="text-muted-foreground mt-3 text-[11.5px]">
      {te('editor.sheet.decisionsFull', language)}
    </p>
  {/if}
</section>
