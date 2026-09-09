<script lang="ts">
  /** Boolean toggle (vendored Switch) — one click, one event, no draft. */
  import { Switch } from '../commons/ui/switch'

  interface Props {
    readonly label: string
    readonly checked: boolean
    readonly commit: (next: boolean) => void
  }

  let { label, checked, commit }: Props = $props()
</script>

<div
  class="border-border flex items-center justify-between py-[7px] text-[13px] first:pt-0 not-last:border-b"
>
  <span>{label}</span>
  <Switch {checked} aria-label={label} onCheckedChange={(next) => commit(next)} />
</div>
