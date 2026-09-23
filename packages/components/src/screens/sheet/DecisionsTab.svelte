<script lang="ts">
  /** Questions commit at blur; a settled outcome commits its two halves together. */
  import { untrack } from 'svelte'
  import type { Decision, Project } from '@project-review/core/model/project'
  import type { Language } from '@project-review/core/model/theme'
  import { te } from '../../i18n'
  import FieldText, { useDrafts } from '../../editor/FieldText.svelte'
  import {
    matchesOutcome,
    outcomeDraft,
    readOutcomeDraft,
    type OutcomeDraft,
  } from '../../editor/decision-outcome'
  import Icon from '../../commons/Icon.svelte'
  import { Button } from '../../commons/ui/button'
  import type { Dispatch } from '../contracts'

  interface Props {
    readonly project: Project
    readonly language: Language
    readonly dispatch: Dispatch
  }

  let { project, language, dispatch }: Props = $props()
  const drafts = useDrafts()

  // The acknowledged list is also the base of consecutive synchronous commits
  // during pagehide, before props have echoed the preceding command.
  let owner = untrack(() => project.id)
  let generation = untrack(() => drafts?.generation)
  let held = $state.raw(untrack(() => project.decisions))
  let outcomes = $state.raw<readonly OutcomeDraft[]>(
    untrack(() => held.map((d) => outcomeDraft(d.taken))),
  )

  $effect(() => {
    const id = project.id
    const decisions = project.decisions
    const nextGeneration = drafts?.generation
    const raw = drafts?.recover?.(
      JSON.stringify(['project', id, 'outcomes']),
      JSON.stringify(decisions),
    )
    untrack(() => {
      if (id === owner && decisions === held && nextGeneration === generation && raw === undefined)
        return
      generation = nextGeneration
      owner = id
      held = decisions
      outcomes = decisions.map((d) => outcomeDraft(d.taken))
      if (raw !== undefined) {
        try {
          const parsed: unknown = JSON.parse(raw)
          if (
            Array.isArray(parsed) &&
            parsed.length === decisions.length &&
            parsed.every(
              (one: unknown) =>
                typeof one === 'object' &&
                one !== null &&
                'text' in one &&
                typeof one.text === 'string' &&
                'when' in one &&
                typeof one.when === 'string',
            )
          )
            outcomes = parsed as OutcomeDraft[]
        } catch {
          /* A malformed local draft never becomes a domain value. */
        }
      }
    })
  })

  function setDecisions(after: readonly Decision[], nextOutcomes = outcomes): void {
    const event = dispatch({ type: 'ChangeProjectDecisions', id: project.id, after })
    if (event?.type !== 'ProjectDecisionsChanged') return
    held = event.after
    outcomes = nextOutcomes
  }

  function patchDecision(index: number, patch: Partial<Decision>): void {
    const current = held[index]
    if (
      current === undefined ||
      Object.entries(patch).every(([key, value]) => current[key as keyof Decision] === value)
    )
      return
    setDecisions(held.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  /** Publish all complete changed drafts in one event; incomplete ones remain pending. */
  function commitOutcomes(): void {
    const after = held.map((decision, index) => {
      const draft = outcomes[index]!
      if (matchesOutcome(draft, decision.taken)) return decision
      const reading = readOutcomeDraft(draft)
      return reading.ok ? { ...decision, taken: reading.taken } : decision
    })
    if (after.some((decision, index) => decision !== held[index])) setDecisions(after)
  }

  function patchOutcome(index: number, patch: Partial<OutcomeDraft>): void {
    outcomes = outcomes.map((draft, i) => (i === index ? { ...draft, ...patch } : draft))
    commitOutcomes()
  }

  const readings = $derived(outcomes.map(readOutcomeDraft))
  // The registry reads only this eager local flag, never mounting-view props.
  // eslint-disable-next-line svelte/prefer-writable-derived
  let unrecorded = $state(false)
  $effect(() => {
    unrecorded = outcomes.some((draft, index) => !matchesOutcome(draft, held[index]?.taken))
  })
  $effect(() =>
    drafts?.checkpoint?.(
      JSON.stringify(['project', project.id, 'outcomes']),
      JSON.stringify(held),
      unrecorded ? JSON.stringify(outcomes) : undefined,
    ),
  )
  $effect(() => drafts?.register({ dirty: () => unrecorded, commit: commitOutcomes }))
</script>

<section class="bg-background border-border rounded-lg border p-4">
  <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
    {te('editor.tab.decisions', language)}
  </h2>
  <p class="text-muted-foreground mb-3 text-xs">{te('editor.sheet.decisionsHint', language)}</p>
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
          onclick={() =>
            setDecisions(
              held.filter((_, i) => i !== index),
              outcomes.filter((_, i) => i !== index),
            )}><Icon name="close-line" /></Button
        >
      </div>
      <FieldText
        {language}
        label={te('editor.sheet.question', language)}
        value={decision.question}
        draftKey={JSON.stringify(['project', project.id, 'decision', index, 'question'])}
        rows={2}
        capacity="decisionQuestion"
        hint={te('editor.hint.question', language)}
        required
        commit={(v) => patchDecision(index, { question: v })}
      />
      <FieldText
        {language}
        label={te('editor.sheet.decider', language)}
        value={decision.decider}
        draftKey={JSON.stringify(['project', project.id, 'decision', index, 'decider'])}
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
            value={outcomes[index]?.text ?? ''}
            draftKey={JSON.stringify(['project', project.id, 'decision', index, 'text'])}
            required
            placeholder="—"
            commit={(v) => patchOutcome(index, { text: v ?? '' })}
          />
          <FieldText
            {language}
            label={te('editor.sheet.takenWhen', language)}
            type="date"
            value={outcomes[index]?.when ?? ''}
            draftKey={JSON.stringify(['project', project.id, 'decision', index, 'when'])}
            required
            placeholder={te('editor.review.dateHint', language)}
            error={readings[index]?.ok === false && readings[index]?.reason === 'invalidDate'
              ? te('editor.error.invalidDate', language, { value: outcomes[index]!.when })
              : undefined}
            commit={(v) => patchOutcome(index, { when: v ?? '' })}
          />
        </div>
        {#if readings[index]?.ok === false && readings[index]?.reason === 'incomplete'}
          <p class="text-(--warn) mt-2 text-[11.5px]" role="status">
            {te('editor.sheet.outcomeIncomplete', language)}
          </p>
        {/if}
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
      onclick={() =>
        setDecisions([...held, { question: '' }], [...outcomes, outcomeDraft(undefined)])}
    >
      {te('editor.sheet.addDecision', language, { n: 3 - project.decisions.length })}
    </Button>
  {:else}
    <p class="text-muted-foreground mt-3 text-[11.5px]">
      {te('editor.sheet.decisionsFull', language)}
    </p>
  {/if}
</section>
