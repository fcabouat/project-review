<script lang="ts">
  /** Milestones tab of the project sheet: the three project dates plus the milestone table, shown by ascending date. */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Milestone, Project } from '@project-review/core/model/project'
  import { isoDate } from '@project-review/core/values/date'
  import { t } from '@project-review/core/services/i18n'
  import type { Language } from '@project-review/core/model/theme'
  import type { ProjectScalarField } from '@project-review/core/events'
  import { te } from '../../i18n'
  import FieldText from '../../editor/FieldText.svelte'
  import Icon from '../../commons/Icon.svelte'
  import { Button } from '../../commons/ui/button'
  import { Checkbox } from '../../commons/ui/checkbox'
  import { Input } from '../../commons/ui/input'
  import type { Dispatch } from '../contracts'

  interface Props {
    readonly project: Project
    readonly portfolio: Portfolio
    readonly language: Language
    readonly dispatch: Dispatch
    readonly set: <F extends ProjectScalarField>(field: F, after: Project[F]) => void
  }

  let { project, portfolio, language, dispatch, set }: Props = $props()

  /** A date field: the brand constructor decides; invalid text is ignored. */
  function commitDate(field: 'start' | 'targetEnd' | 'actualEnd', v: string | undefined): void {
    if (v === undefined) {
      set(field, undefined)
      return
    }
    const when = isoDate(v)
    if (when !== undefined) set(field, when)
  }

  function setMilestones(after: readonly Milestone[]): void {
    dispatch({ type: 'ChangeProjectMilestones', id: project.id, after })
  }

  /** Milestones are SHOWN by ascending date — entry order carries no meaning. */
  const sortedMilestones = $derived(
    project.milestones
      .map((milestone, index) => ({ milestone, index }))
      .sort((a, b) =>
        a.milestone.date < b.milestone.date ? -1 : a.milestone.date > b.milestone.date ? 1 : 0,
      ),
  )

  function patchMilestone(index: number, patch: Partial<Milestone>): void {
    setMilestones(project.milestones.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  const MROW = 'grid grid-cols-[1.5fr_1fr_0.9fr_46px_34px] items-center gap-2.5'
</script>

<section class="bg-background border-border rounded-lg border p-4">
  <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
    {te('editor.sheet.timeAndMilestones', language)}
  </h2>
  <div class="grid grid-cols-1 gap-3.5 md:grid-cols-3">
    <FieldText
      {language}
      label={t('sheet.start', language)}
      value={project.start}
      placeholder={te('editor.review.dateHint', language)}
      commit={(v) => commitDate('start', v)}
    />
    <FieldText
      {language}
      label={t('sheet.targetEnd', language)}
      value={project.targetEnd}
      placeholder={te('editor.review.dateHint', language)}
      commit={(v) => commitDate('targetEnd', v)}
    />
    <FieldText
      {language}
      label={t('sheet.actualEnd', language)}
      value={project.actualEnd}
      placeholder={te('editor.review.dateHint', language)}
      commit={(v) => commitDate('actualEnd', v)}
    />
  </div>

  <!-- The milestone rows keep their five columns everywhere: on narrow
       screens the LIST scrolls sideways inside this container (same rule as
       the Projects table — the body never scrolls horizontally). -->
  <div class="mt-3.5 mb-3 overflow-x-auto overscroll-x-contain">
    <div class="min-w-[560px]">
      <div
        class="{MROW} border-border text-muted-foreground border-b px-0.5 pb-[7px] text-[10.5px] font-bold tracking-[0.04em] uppercase"
      >
        <span>{te('editor.sheet.milestoneLabel', language)}</span>
        <span>{te('editor.sheet.milestoneDate', language)}</span>
        <span>{te('editor.sheet.milestoneDisplay', language)}</span>
        <span class="text-center">{te('editor.sheet.milestoneDone', language)}</span>
        <span></span>
      </div>
      {#each sortedMilestones as entry (entry.index)}
        <div class="{MROW} border-border border-b px-0.5 py-[7px] last:border-b-0">
          <!-- Wholesale-replacement rule again: commit at blur ONLY on a real
                   change — `decide` cannot dedup a whole milestones list, so a
                   plain focus/blur would spend the redo stack. -->
          <Input
            class="h-8 text-[13px]"
            value={entry.milestone.label}
            aria-label={te('editor.sheet.milestoneLabel', language)}
            onblur={(e) => {
              const next = e.currentTarget.value
              if (next !== entry.milestone.label) patchMilestone(entry.index, { label: next })
            }}
          />
          <Input
            class="h-8 text-[13px]"
            value={entry.milestone.date}
            placeholder={te('editor.review.dateHint', language)}
            aria-label={te('editor.sheet.milestoneDate', language)}
            onblur={(e) => {
              const next = isoDate(e.currentTarget.value)
              if (next === undefined) e.currentTarget.value = entry.milestone.date
              else if (next !== entry.milestone.date) patchMilestone(entry.index, { date: next })
            }}
          />
          <Input
            class="h-8 text-[13px]"
            value={entry.milestone.display ?? ''}
            placeholder="—"
            aria-label={te('editor.sheet.milestoneDisplay', language)}
            onblur={(e) => {
              const next = e.currentTarget.value || undefined
              if (next !== entry.milestone.display) patchMilestone(entry.index, { display: next })
            }}
          />
          <span class="flex justify-center">
            <Checkbox
              checked={entry.milestone.done}
              aria-label={te('editor.sheet.milestoneDone', language)}
              onCheckedChange={(done) => patchMilestone(entry.index, { done })}
            />
          </span>
          <span class="flex justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground"
              title={te('editor.projects.delete', language)}
              aria-label={te('editor.projects.delete', language)}
              onclick={() => setMilestones(project.milestones.filter((_, i) => i !== entry.index))}
              ><Icon name="close-line" /></Button
            >
          </span>
        </div>
      {:else}
        <p class="text-muted-foreground pt-2 text-[11.5px]">
          {te('editor.sheet.noMilestone', language)}
        </p>
      {/each}
    </div>
  </div>

  {#if project.milestones.length < 6}
    <Button
      variant="outline"
      size="sm"
      onclick={() =>
        setMilestones([
          ...project.milestones,
          // Born empty: the display does the "—" fallback.
          { label: '', date: portfolio.review.reviewDate, done: false },
        ])}>{te('editor.sheet.addMilestone', language)}</Button
    >
  {:else}
    <p class="text-muted-foreground text-[11.5px]">{te('editor.sheet.milestonesFull', language)}</p>
  {/if}
  <p class="text-muted-foreground mt-2 text-[11.5px]">
    {te('editor.sheet.milestonesSorted', language)}
  </p>
</section>
