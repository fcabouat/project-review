<script lang="ts">
  /**
   * E2 — the project sheet, in TABS rather than one long scroll: "Frame & status
   * · Narrative · Decisions · Milestones & dates · Options".
   *
   * Field ↔ command, at blur: `decide` reads the `before` and drops the
   * scalar no-ops. The WHOLESALE replacements (lists, milestones, decisions)
   * keep their local equality guards — `decide` deliberately lets deep payloads
   * through, so the emitter is the one place that can spare the redo stack.
   *
   * The id is NOT a field: it only moves through `RenumberProject`, and the
   * uniqueness check lives in `decide` — a refused renumbering comes back as
   * `undefined` and surfaces as the alert below.
   *
   * The screen is addressed by `#/sheet/{id}`: the project id comes from the
   * route. Pure screen (screens contract, `contracts.ts`): navigation goes out
   * through the two callbacks — `navigate` pushes a history entry (back to the
   * table), `replaceRoute` swaps the current one (unknown id, renumbering).
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type {
    Decision,
    HealthLevel,
    Milestone,
    Priority,
    Project,
    SheetMode,
    Stage,
  } from '@project-review/core/model/project'
  import { HEALTH_LEVELS, PRIORITIES, STAGES } from '@project-review/core/model/project'
  import {
    categoryOf,
    isPreProject,
    progressRamp,
    projectById,
    showsSheet,
  } from '@project-review/core/projections'
  import { parseLine } from '@project-review/core/model/text-line'
  import { categoryId, projectId as asProjectId } from '@project-review/core/values/ids'
  import { isoDate } from '@project-review/core/values/date'
  import { progressOf } from '@project-review/core/values/progress'
  import { catColor } from '../commons/cat-color'
  import { formatShortDate, t } from '@project-review/core/services/i18n'
  import type { NarrativeList, ProjectScalarField } from '@project-review/core/events'
  import { te } from '../i18n'
  import { projectWarnings } from '../editor/validation'
  import Icon from '../commons/Icon.svelte'
  import { BAND_COLOR } from '../commons/band-color'
  import SlidePreviewDialog from '../editor/SlidePreviewDialog.svelte'
  import FieldText from '../editor/FieldText.svelte'
  import FieldSegmented from '../editor/FieldSegmented.svelte'
  import FieldSwitch from '../editor/FieldSwitch.svelte'
  import type { Dispatch, Route } from './contracts'

  type Tab = 'state' | 'narrative' | 'decisions' | 'milestones' | 'options'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    /** From the route `#/sheet/{id}` — the shell passes it down. */
    readonly projectId: string
    /** Pushes a new history entry — « Retour à la liste ». */
    readonly navigate: (route: Route) => void
    /** Replaces the current entry — redirects (unknown id, renumbering). */
    readonly replaceRoute: (route: Route) => void
  }

  let { portfolio, dispatch, projectId, navigate, replaceRoute }: Props = $props()

  let tab = $state<Tab>('state')
  /** Mounted only while open: a closed preview renders no slide at all (E2ter). */
  let previewing = $state(false)

  const language = $derived(portfolio.settings.language)
  const project = $derived(projectById(portfolio, projectId))
  const warnings = $derived(project ? projectWarnings(project) : [])

  // Unknown id (deleted project, hand-typed hash): back to the table, without
  // piling a dead entry onto the browser history.
  $effect(() => {
    if (!project) replaceRoute({ name: 'projects' })
  })

  function back(): void {
    navigate({ name: 'projects' })
  }

  const TABS: readonly { readonly id: Tab; readonly key: string }[] = [
    { id: 'state', key: 'editor.tab.state' },
    { id: 'narrative', key: 'editor.tab.narrative' },
    { id: 'decisions', key: 'editor.tab.decisions' },
    { id: 'milestones', key: 'editor.tab.milestones' },
    { id: 'options', key: 'editor.tab.options' },
  ]

  /** One scalar field of the project — one command, typed by the field. */
  function set<F extends ProjectScalarField>(field: F, after: Project[F]): void {
    if (!project) return
    dispatch({ type: 'ChangeProjectField', id: project.id, field, after } as never)
  }

  /** A date field: the brand constructor decides; invalid text is ignored. */
  function commitDate(field: 'start' | 'targetEnd' | 'actualEnd', v: string | undefined): void {
    if (v === undefined) {
      set(field, undefined)
      return
    }
    const when = isoDate(v)
    if (when !== undefined) set(field, when)
  }

  function setList(list: NarrativeList, text: string | undefined): void {
    if (!project) return
    const after = (text ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '')
    // Wholesale replacement: deep equality is the emitter's business.
    const before = project[list]
    if (before.length === after.length && before.every((l, i) => l === after[i])) return
    dispatch({ type: 'ChangeProjectList', id: project.id, list, after })
  }

  function setDecisions(after: readonly Decision[]): void {
    if (!project) return
    dispatch({ type: 'ChangeProjectDecisions', id: project.id, after })
  }

  function setMilestones(after: readonly Milestone[]): void {
    if (!project) return
    dispatch({ type: 'ChangeProjectMilestones', id: project.id, after })
  }

  /**
   * Renumbering: the ONE way an id changes. Uniqueness is `decide`'s check —
   * a refused command records nothing and comes back `undefined`, which is
   * exactly when the user needs the alert.
   */
  function renumber(): void {
    if (!project) return
    const proposed = window.prompt(
      te('editor.sheet.renumberPrompt', language, { id: project.id }),
      project.id,
    )
    const next = asProjectId(proposed?.trim() ?? '')
    if (!next || next === project.id) return
    const event = dispatch({ type: 'RenumberProject', id: project.id, newId: next })
    if (event === undefined) {
      window.alert(te('editor.sheet.renumberTaken', language, { id: next }))
      return
    }
    // The route addresses the OLD id: swap it for the new one in place.
    replaceRoute({ name: 'sheet', id: next })
  }

  /** Milestones are SHOWN by ascending date — entry order carries no meaning. */
  const sortedMilestones = $derived(
    project
      ? project.milestones
          .map((milestone, index) => ({ milestone, index }))
          .sort((a, b) =>
            a.milestone.date < b.milestone.date ? -1 : a.milestone.date > b.milestone.date ? 1 : 0,
          )
      : [],
  )

  function patchMilestone(index: number, patch: Partial<Milestone>): void {
    if (!project) return
    setMilestones(project.milestones.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  function patchDecision(index: number, patch: Partial<Decision>): void {
    if (!project) return
    setDecisions(project.decisions.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  /** `taken` is present or absent — never `{ text: '', when: '' }`:
   * the outcome settles only once BOTH the text and a valid date are there. */
  function patchOutcome(index: number, patch: { text?: string; when?: string }): void {
    if (!project) return
    const current = project.decisions[index]
    if (!current) return
    const text = patch.text ?? current.taken?.text ?? ''
    const when = isoDate(patch.when ?? current.taken?.when ?? '')
    const taken = text !== '' && when !== undefined ? { text, when } : undefined
    setDecisions(project.decisions.map((d, i) => (i === index ? { ...d, taken } : d)))
  }

  const sheetHint = $derived.by(() => {
    if (!project) return ''
    return te(`editor.hint.sheet.${project.sheet}`, language)
  })

  /**
   * TRUE cause of the sheet's presence, mirror of `showsSheet` cause by cause:
   * forced mode, then stage, then pending decision. The stage case is told
   * apart by PROBING the same predicate on a decision-less copy rather than by
   * restating its stage list here.
   */
  const sheetReason = $derived.by(() => {
    if (!project) return ''
    if (!showsSheet(project)) return te('editor.reason.hidden', language)
    if (project.sheet === 'always') return te('editor.reason.shownAlways', language)
    if (showsSheet({ ...project, decisions: [] }))
      return te('editor.reason.shownStage', language, {
        stage: t(`stage.${project.stage}`, language),
      })
    return te('editor.reason.shownDecision', language)
  })

  const category = $derived(project ? categoryOf(portfolio, project.categoryId) : undefined)
  const progressPct = $derived(project?.progress ?? 0)
</script>

{#if !project}
  <p class="table-empty">{te('editor.sheet.missing', language)}</p>
{:else}
  <div class="appbar appbar-e2">
    <nav class="breadcrumb">
      <button class="link-btn" type="button" onclick={back}>
        {te('editor.sheet.breadcrumb', language)}
      </button>
      <span class="sep">/</span>
      <span class="current">{project.id}</span>
    </nav>
    <div class="e2-bar-main">
      <div class="e2-head-fields">
        <label class="field field-id">
          <span>{te('editor.field.id', language)}</span>
          <span style="display:flex;gap:6px;align-items:center">
            <input
              class="input"
              value={project.id}
              readonly
              title={te('editor.sheet.idLocked', language)}
              aria-label={te('editor.field.id', language)}
            />
            <button
              class="icon-btn"
              type="button"
              title={te('editor.sheet.renumber', language)}
              aria-label={te('editor.sheet.renumber', language)}
              onclick={renumber}>✎</button
            >
          </span>
        </label>

        <div class="field field-name">
          <FieldText
            {language}
            label={te('editor.field.name', language)}
            value={project.name}
            max={60}
            commit={(v) => set('name', v ?? project.id)}
          />
        </div>

        <div class="field field-cat">
          <span>{te('editor.field.categoryId', language)}</span>
          <select
            class="select-trigger"
            value={project.categoryId}
            aria-label={te('editor.field.categoryId', language)}
            onchange={(e) =>
              set('categoryId', categoryId(e.currentTarget.value) ?? project.categoryId)}
            style={category ? `border-left:4px solid ${catColor(category.color)}` : undefined}
          >
            {#each portfolio.categories as c (c.id)}
              <option value={c.id}>{c.name}</option>
            {/each}
          </select>
        </div>
      </div>
      <button class="btn btn-primary" type="button" onclick={() => (previewing = true)}>
        <Icon name="eye-line" />
        {te('editor.preview.button', language)}
      </button>
    </div>
  </div>

  <div class="etabs" role="tablist">
    {#each TABS as entry (entry.id)}
      <button
        class="etab-label"
        class:active={tab === entry.id}
        type="button"
        role="tab"
        aria-selected={tab === entry.id}
        onclick={() => (tab = entry.id)}>{te(entry.key, language)}</button
      >
    {/each}
  </div>

  <div class="e2-body">
    {#if warnings.length > 0}
      <ul class="softcheck">
        {#each warnings as warning, i (i)}
          <li>{te(warning.key, language, warning.slots)}</li>
        {/each}
      </ul>
    {/if}

    {#if tab === 'state'}
      <div class="e2-grid">
        <section class="card">
          <h2>{te('editor.sheet.status', language)}</h2>

          <FieldSegmented
            label={te('editor.field.stage', language)}
            value={project.stage}
            options={STAGES.map((stage) => ({
              value: stage,
              label: t(`stage.${stage}`, language),
            }))}
            commit={(v: Stage) => set('stage', v)}
          />

          <FieldSwitch
            label={te('editor.field.onHold', language)}
            checked={project.onHold}
            commit={(v) => set('onHold', v)}
          />

          <div class="field-group">
            <span class="label">{te('editor.field.health', language)}</span>
            <div
              class="health-radios"
              role="radiogroup"
              aria-label={te('editor.field.health', language)}
            >
              {#each [undefined, ...HEALTH_LEVELS] as level (level ?? 'notAssessed')}
                {@const key = level ?? 'notAssessed'}
                <label class="health-opt h-{key}" class:checked={project.health === level}>
                  <input
                    type="radio"
                    name="health-{project.id}"
                    checked={project.health === level}
                    onchange={() => set('health', level as HealthLevel | undefined)}
                  />
                  <span class="dot health-{level ?? 'ne'}"></span>{t(`level.${key}`, language)}
                </label>
              {/each}
            </div>
          </div>

          <FieldSegmented
            label={te('editor.field.priority', language)}
            value={project.priority ?? '—'}
            options={[
              ...PRIORITIES.map((p) => ({ value: p as Priority | '—', label: p })),
              { value: '—' as Priority | '—', label: t('priority.none', language) },
            ]}
            commit={(v) => set('priority', v === '—' ? undefined : (v as Priority))}
          />

          <div class="field-group" style="margin-bottom:0">
            <span class="label">{te('editor.field.progress', language)}</span>
            <div class="range-row">
              <!-- Pitfall n° 3: before launch the value is ignored by every render. -->
              <input
                type="range"
                min="0"
                max="100"
                value={progressPct}
                aria-label={te('editor.field.progress', language)}
                style="--rv:{progressPct}%;--rc:{BAND_COLOR[progressRamp(project.progress)]}"
                onchange={(e) => set('progress', progressOf(Number(e.currentTarget.value))!)}
              />
              <span class="pctfield">{te('editor.value.pct', language, { n: progressPct })}</span>
            </div>
            {#if isPreProject(project)}
              <span class="hint">{te('editor.hint.progressIgnored', language)}</span>
            {/if}
          </div>
        </section>

        <section class="card">
          <h2>{te('editor.sheet.frame', language)}</h2>
          <FieldText
            {language}
            label={te('editor.field.lead', language)}
            value={project.lead}
            max={40}
            commit={(v) => set('lead', v)}
          />
          <FieldText
            {language}
            label={te('editor.field.sponsor', language)}
            value={project.sponsor}
            max={40}
            commit={(v) => set('sponsor', v)}
          />
          <FieldText
            {language}
            label={te('editor.field.scope', language)}
            value={project.scope}
            max={80}
            hint={te('editor.hint.scope', language)}
            commit={(v) => set('scope', v)}
          />
          <FieldText
            {language}
            label={te('editor.field.goal', language)}
            value={project.goal}
            rows={3}
            max={240}
            hint={te('editor.hint.goal', language)}
            commit={(v) => set('goal', v ?? '')}
          />
          <FieldText
            {language}
            label={te('editor.field.budget', language)}
            value={project.budget}
            max={80}
            hint={te('editor.hint.budget', language)}
            commit={(v) => set('budget', v)}
          />
        </section>
      </div>
    {:else if tab === 'narrative'}
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
    {:else if tab === 'decisions'}
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
                onclick={() => setDecisions(project.decisions.filter((_, i) => i !== index))}
                >✕</button
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
    {:else if tab === 'milestones'}
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
                  else if (next !== entry.milestone.date)
                    patchMilestone(entry.index, { date: next })
                }}
              />
              <input
                class="input"
                value={entry.milestone.display ?? ''}
                placeholder="—"
                aria-label={te('editor.sheet.milestoneDisplay', language)}
                onblur={(e) => {
                  const next = e.currentTarget.value || undefined
                  if (next !== entry.milestone.display)
                    patchMilestone(entry.index, { display: next })
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
                  onclick={() =>
                    setMilestones(project.milestones.filter((_, i) => i !== entry.index))}>✕</button
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
                { label: '—', date: portfolio.review.reviewDate, done: false },
              ])}>{te('editor.sheet.addMilestone', language)}</button
          >
        {:else}
          <p class="hint">{te('editor.sheet.milestonesFull', language)}</p>
        {/if}
        <p class="hint" style="margin-top:8px">{te('editor.sheet.milestonesSorted', language)}</p>
      </section>
    {:else}
      <section class="card">
        <h2>{te('editor.sheet.options', language)}</h2>
        <div class="options-row">
          <FieldSegmented
            label={te('editor.field.sheet', language)}
            value={project.sheet}
            options={(['auto', 'always', 'never'] as const).map((mode) => ({
              value: mode as SheetMode,
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
              {project.updatedOn
                ? formatShortDate(project.updatedOn)
                : t('priority.none', language)}
            </span>
          </div>
        </div>
        <p class="hint" style="margin-top:14px">{sheetReason}</p>
      </section>
    {/if}
  </div>

  <div
    style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted)"
  >
    <span>{te('editor.sheet.continuous', language)}</span>
    <button class="link-btn" type="button" onclick={back}
      >{te('editor.sheet.back', language)}</button
    >
  </div>

  {#if previewing}
    <SlidePreviewDialog
      {portfolio}
      slide={{ type: 'sheet', projectId: project.id }}
      subject={te('editor.preview.subject.sheet', language, { id: project.id })}
      close={() => (previewing = false)}
    />
  {/if}
{/if}
