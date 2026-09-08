<script lang="ts">
  /**
   * Priority P1 / P2 / P3 — white chip with a grey hairline (mockup `.chip--prio`).
   * Missing priority: "—" (key `priority.none`), never an empty cell:
   * the sheet banner keeps its metrics.
   */
  import type { Language } from '@project-review/core/model/theme'
  import type { Priority } from '@project-review/core/model/project'
  import { t } from '@project-review/core/services/i18n'

  interface Props {
    readonly priority?: Priority
    readonly language: Language
  }

  let { priority, language }: Props = $props()

  const label = $derived(priority ?? t('priority.none', language))
</script>

<span class="chip" class:missing={priority === undefined}>{label}</span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 9px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    background: #fff;
    color: var(--txt2);
    border: 1px solid var(--border);
  }
  .missing {
    color: var(--muted);
  }
</style>
