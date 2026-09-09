<script lang="ts">
  /** Aggregate-slides card: visibility switches for the aggregate slides and the recap row count. */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { te } from '../../i18n'
  import FieldSwitch from '../../editor/FieldSwitch.svelte'
  import { Button } from '../../commons/ui/button'
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

<section class="bg-background border-border rounded-lg border p-4">
  <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
    {te('editor.settings.aggregates', language)}
  </h2>
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
  <div
    class="border-border text-(--txt2) mt-0.5 flex items-center justify-between border-t pt-2.5 text-[12.5px] font-semibold"
  >
    <span>{te('editor.setting.recapRows', language)}</span>
    <span class="border-input inline-flex items-center overflow-hidden rounded-md border">
      <Button
        variant="ghost"
        class="size-[22px] rounded-none p-0 text-[13px]"
        aria-label={te('editor.settings.decrease', language)}
        disabled={settings.recapRows <= 6}
        onclick={() => setRecapLines(settings.recapRows - 1)}>−</Button
      >
      <span
        class="border-input h-[22px] w-[26px] border-x text-center text-xs leading-[22px] font-bold"
        >{settings.recapRows}</span
      >
      <Button
        variant="ghost"
        class="size-[22px] rounded-none p-0 text-[13px]"
        aria-label={te('editor.settings.increase', language)}
        disabled={settings.recapRows >= 16}
        onclick={() => setRecapLines(settings.recapRows + 1)}>+</Button
      >
    </span>
  </div>
</section>
