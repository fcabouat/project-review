<script lang="ts" generics="T">
  /**
   * Closed scale as a segmented control (`.segmented`): every value of the
   * ADT is visible at once, so the user reads the scale instead of discovering it
   * in a dropdown. A click = one event, immediately (there is no draft to lose).
   */
  interface Option {
    readonly value: T
    readonly label: string
    readonly title?: string
  }

  interface Props {
    readonly label?: string
    readonly options: readonly Option[]
    readonly value: T
    readonly commit: (next: T) => void
    readonly hint?: string
    readonly ariaLabel?: string
  }

  let { label, options, value, commit, hint, ariaLabel }: Props = $props()
</script>

<div class="field-group">
  {#if label}<span class="label">{label}</span>{/if}
  <div class="segmented" role="group" aria-label={ariaLabel ?? label}>
    {#each options as option (String(option.value))}
      <button
        type="button"
        class:active={option.value === value}
        aria-pressed={option.value === value}
        title={option.title}
        onclick={() => {
          if (option.value !== value) commit(option.value)
        }}
      >
        {option.label}
      </button>
    {/each}
  </div>
  {#if hint}<span class="hint">{hint}</span>{/if}
</div>
