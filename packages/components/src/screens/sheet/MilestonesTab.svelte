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
</script>

<section class="card">
  <h2>{te('editor.sheet.timeAndMilestones', language)}</h2>
  <div class="subgrid-3">
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

  <div class="milestones-table">
    <div class="milestones-head">
      <span>{te('editor.sheet.milestoneLabel', language)}</span>
      <span>{te('editor.sheet.milestoneDate', language)}</span>
      <span>{te('editor.sheet.milestoneDisplay', language)}</span>
      <span>{te('editor.sheet.milestoneDone', language)}</span>
      <span></span>
    </div>
    {#each sortedMilestones as entry (entry.index)}
      <div class="jalon-row">
        <!-- Wholesale-replacement rule again: commit at blur ONLY on a real
                   change — `decide` cannot dedup a whole milestones list, so a
                   plain focus/blur would spend the redo stack. -->
        <input
          class="input"
          value={entry.milestone.label}
          aria-label={te('editor.sheet.milestoneLabel', language)}
          onblur={(e) => {
            const next = e.currentTarget.value
            if (next !== entry.milestone.label) patchMilestone(entry.index, { label: next })
          }}
        />
        <input
          class="input"
          value={entry.milestone.date}
          placeholder={te('editor.review.dateHint', language)}
          aria-label={te('editor.sheet.milestoneDate', language)}
          onblur={(e) => {
            const next = isoDate(e.currentTarget.value)
            if (next === undefined) e.currentTarget.value = entry.milestone.date
            else if (next !== entry.milestone.date) patchMilestone(entry.index, { date: next })
          }}
        />
        <input
          class="input"
          value={entry.milestone.display ?? ''}
          placeholder="—"
          aria-label={te('editor.sheet.milestoneDisplay', language)}
          onblur={(e) => {
            const next = e.currentTarget.value || undefined
            if (next !== entry.milestone.display) patchMilestone(entry.index, { display: next })
          }}
        />
        <input
          type="checkbox"
          checked={entry.milestone.done}
          aria-label={te('editor.sheet.milestoneDone', language)}
          onchange={(e) => patchMilestone(entry.index, { done: e.currentTarget.checked })}
        />
        <span class="row-actions">
          <button
            class="icon-btn"
            type="button"
            title={te('editor.projects.delete', language)}
            aria-label={te('editor.projects.delete', language)}
            onclick={() => setMilestones(project.milestones.filter((_, i) => i !== entry.index))}
            >✕</button
          >
        </span>
      </div>
    {:else}
      <p class="hint" style="padding-top:8px">{te('editor.sheet.noMilestone', language)}</p>
    {/each}
  </div>

  {#if project.milestones.length < 6}
    <button
      class="btn btn-secondary btn-sm"
      type="button"
      onclick={() =>
        setMilestones([
          ...project.milestones,
          // Born empty: the display does the "—" fallback.
          { label: '', date: portfolio.review.reviewDate, done: false },
        ])}>{te('editor.sheet.addMilestone', language)}</button
    >
  {:else}
    <p class="hint">{te('editor.sheet.milestonesFull', language)}</p>
  {/if}
  <p class="hint" style="margin-top:8px">{te('editor.sheet.milestonesSorted', language)}</p>
</section>
