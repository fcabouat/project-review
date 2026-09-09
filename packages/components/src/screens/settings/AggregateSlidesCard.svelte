<script lang="ts">
  /** Aggregate-slides card: visibility switches for the aggregate slides and the recap row count. */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { te } from '../../i18n'
  import FieldSwitch from '../../editor/FieldSwitch.svelte'
  import type { Dispatch } from '../contracts'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
  }

  let { portfolio, dispatch }: Props = $props()

  const settings = $derived(portfolio.settings)
  const language = $derived(settings.language)

  /**
   * Flattened settings path: one key, one command. Narrow helpers rather
   * than one generic writer — the `setting ↔ value` correlation is exactly what
   * a single signature cannot express; here the types simply stay honest per
   * group.
   */
  function setShow(setting: keyof typeof settings.show, after: boolean): void {
    dispatch({ type: 'ChangeSetting', setting, after })
  }

  function setRecapLines(after: number): void {
    // UI clamp — the steppers stop at the bounds; `decide` drops the no-ops.
    if (after < 6 || after > 16) return
    dispatch({ type: 'ChangeSetting', setting: 'recapRows', after })
  }
</script>

<section class="card">
  <h2>{te('editor.settings.aggregates', language)}</h2>
  <FieldSwitch
    label={te('editor.setting.healthDashboard', language)}
    checked={settings.show.healthDashboard}
    commit={(v) => setShow('healthDashboard', v)}
  />
  <FieldSwitch
    label={te('editor.setting.recap', language)}
    checked={settings.show.recap}
    commit={(v) => setShow('recap', v)}
  />
  <FieldSwitch
    label={te('editor.setting.archives', language)}
    checked={settings.show.archives}
    commit={(v) => setShow('archives', v)}
  />
  <FieldSwitch
    label={te('editor.setting.decisions', language)}
    checked={settings.show.decisions}
    commit={(v) => setShow('decisions', v)}
  />
  <div class="stepper-row">
    <span>{te('editor.setting.recapRows', language)}</span>
    <span class="stepper">
      <button
        type="button"
        aria-label={te('editor.settings.decrease', language)}
        disabled={settings.recapRows <= 6}
        onclick={() => setRecapLines(settings.recapRows - 1)}>−</button
      >
      <span class="val">{settings.recapRows}</span>
      <button
        type="button"
        aria-label={te('editor.settings.increase', language)}
        disabled={settings.recapRows >= 16}
        onclick={() => setRecapLines(settings.recapRows + 1)}>+</button
      >
    </span>
  </div>
</section>
