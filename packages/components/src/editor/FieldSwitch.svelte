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
    /** Short explanation exposed as a native tooltip and screen-reader description. */
    readonly hint?: string
  }

  let { label, checked, commit, disabled = false, hint }: Props = $props()
  const hintId = $props.id()
</script>

<div
  class="border-border flex items-center justify-between py-[7px] text-[13px] first:pt-0 not-last:border-b"
  title={hint}
>
  <span>{label}</span>
  <Switch
    {checked}
    {disabled}
    aria-label={label}
    aria-describedby={hint ? hintId : undefined}
    onCheckedChange={(next) => commit(next)}
  />
  {#if hint}<span id={hintId} class="sr-only">{hint}</span>{/if}
</div>
