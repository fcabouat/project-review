<script lang="ts">
  /** Boolean toggle (vendored Switch) — one click, one event, no draft. */
  import { Switch } from '../commons/ui/switch'

  interface Props {
    readonly label: string
    readonly checked: boolean
    readonly commit: (next: boolean) => void
    /** The setting cannot be exercised at all (no storage, for instance): the
     * control is disabled rather than left to move a value nothing honours. */
    readonly disabled?: boolean
  }

  let { label, checked, commit, disabled = false }: Props = $props()
</script>

<div
  class="border-border flex items-center justify-between py-[7px] text-[13px] first:pt-0 not-last:border-b"
>
  <span>{label}</span>
  <Switch {checked} {disabled} aria-label={label} onCheckedChange={(next) => commit(next)} />
</div>
