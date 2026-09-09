<script lang="ts">
  /** Status-and-frame tab of the project sheet: stage, hold, health, priority, progress, and the framing fields (lead, sponsor, scope, goal, budget). */
  import type { HealthLevel, Priority, Project, Stage } from '@project-review/core/model/project'
  import { HEALTH_LEVELS, PRIORITIES, STAGES } from '@project-review/core/model/project'
  import { isPreProject, progressRamp } from '@project-review/core/projections'
  import { progressOf } from '@project-review/core/values/progress'
  import { t } from '@project-review/core/services/i18n'
  import type { Language } from '@project-review/core/model/theme'
  import type { ProjectScalarField } from '@project-review/core/events'
  import { te } from '../../i18n'
  import { BAND_COLOR } from '../../commons/band-color'
  import FieldText from '../../editor/FieldText.svelte'
  import FieldSegmented from '../../editor/FieldSegmented.svelte'
  import FieldSwitch from '../../editor/FieldSwitch.svelte'

  interface Props {
    readonly project: Project
    readonly language: Language
    readonly set: <F extends ProjectScalarField>(field: F, after: Project[F]) => void
  }

  let { project, language, set }: Props = $props()

  const progressPct = $derived(project.progress ?? 0)
</script>

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
      <div class="health-radios" role="radiogroup" aria-label={te('editor.field.health', language)}>
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
        <!-- Before launch the value is ignored by every render. -->
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
