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
  import * as RadioGroup from '../../commons/ui/radio-group'

  interface Props {
    readonly project: Project
    readonly language: Language
    readonly set: <F extends ProjectScalarField>(field: F, after: Project[F]) => void
  }

  let { project, language, set }: Props = $props()

  const progressPct = $derived(project.progress ?? 0)

  /** Level keys in display order — `notAssessed` models the absent value. */
  const LEVEL_KEYS = ['notAssessed', ...HEALTH_LEVELS] as const

  const CHIP =
    'has-[:focus-visible]:outline-ring border-input text-(--txt2) relative inline-flex ' +
    'cursor-pointer items-center gap-1.5 rounded-full border bg-background px-[11px] py-[5px] ' +
    'text-[12.5px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2'

  /** Checked chip tones — literal class lists so the scanner sees them. */
  const CHECKED: Record<(typeof LEVEL_KEYS)[number], string> = {
    notAssessed: 'bg-(--ne-bg) text-(--ne) border-(--ne)',
    onTrack: 'bg-(--ok-bg) text-(--ok) border-(--ok)',
    watch: 'bg-(--vig-bg) text-(--vig-txt) border-(--vig-dot)',
    alert: 'bg-(--warn-bg) text-(--warn) border-(--warn)',
    critical: 'bg-(--err-bg) text-(--err) border-(--err)',
  }

  const DOT: Record<(typeof LEVEL_KEYS)[number], string> = {
    notAssessed: 'bg-(--ne)',
    onTrack: 'bg-(--ok)',
    watch: 'bg-(--vig-dot)',
    alert: 'bg-(--warn)',
    critical: 'bg-(--err)',
  }
</script>

<div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
  <section class="bg-background border-border rounded-lg border p-4">
    <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
      {te('editor.sheet.status', language)}
    </h2>

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

    <div class="my-4 flex flex-col gap-[7px]">
      <span class="text-(--txt2) text-[12.5px] font-semibold"
        >{te('editor.field.health', language)}</span
      >
      <RadioGroup.Root
        class="flex flex-wrap gap-2"
        value={project.health ?? 'notAssessed'}
        onValueChange={(v) => set('health', v === 'notAssessed' ? undefined : (v as HealthLevel))}
        aria-label={te('editor.field.health', language)}
      >
        {#each LEVEL_KEYS as key (key)}
          {@const checked = (project.health ?? 'notAssessed') === key}
          <label class="{CHIP} {checked ? CHECKED[key] : ''}">
            <RadioGroup.Item value={key} class="sr-only" />
            <span class="inline-block size-2.5 flex-none rounded-full {DOT[key]}"></span>{t(
              `level.${key}`,
              language,
            )}
          </label>
        {/each}
      </RadioGroup.Root>
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

    <div class="flex flex-col gap-[7px]">
      <span class="text-(--txt2) text-[12.5px] font-semibold"
        >{te('editor.field.progress', language)}</span
      >
      <div class="flex items-center gap-3">
        <!-- Before launch the value is ignored by every render. The range
             keeps its editor.css styling: the WebKit/Gecko thumb pseudo
             elements are exactly what utilities cannot express. -->
        <input
          type="range"
          min="0"
          max="100"
          value={progressPct}
          aria-label={te('editor.field.progress', language)}
          style="--rv:{progressPct}%;--rc:{BAND_COLOR[progressRamp(project.progress)]}"
          onchange={(e) => set('progress', progressOf(Number(e.currentTarget.value))!)}
        />
        <span
          class="border-input text-foreground flex h-8 w-[54px] flex-none items-center justify-center rounded-md border text-[13px] font-bold tabular-nums"
          >{te('editor.value.pct', language, { n: progressPct })}</span
        >
      </div>
      {#if isPreProject(project)}
        <span class="text-muted-foreground text-[11.5px]"
          >{te('editor.hint.progressIgnored', language)}</span
        >
      {/if}
    </div>
  </section>

  <section class="bg-background border-border rounded-lg border p-4">
    <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
      {te('editor.sheet.frame', language)}
    </h2>
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
