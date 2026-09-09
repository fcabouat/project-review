<script lang="ts">
  /** Boolean toggle (`.switch`) — one click, one event, no draft. */
  interface Props {
    readonly label: string
    readonly checked: boolean
    readonly commit: (next: boolean) => void
  }

  let { label, checked, commit }: Props = $props()
</script>

<div class="togglerow">
  <span>{label}</span>
  <label class="switch">
    <input
      type="checkbox"
      {checked}
      aria-label={label}
      onchange={(e) => commit(e.currentTarget.checked)}
    />
    <span class="switch-track"><span class="switch-thumb"></span></span>
  </label>
</div>
