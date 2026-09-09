<script lang="ts" generics="T">
  /**
   * Closed scale as a segmented control: every value of the ADT is visible at
   * once, so the user reads the scale instead of discovering it in a dropdown.
   * A click = one event, immediately (there is no draft to lose). Plain
   * buttons + utilities: the vendored kit has no segmented primitive, and tabs
   * would misstate the semantics (this is a value chooser, not a view switch).
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

<div class="mb-4 flex flex-col gap-[7px] last:mb-0">
  {#if label}<span class="text-(--txt2) text-[12.5px] font-semibold">{label}</span>{/if}
  <!-- `flex-wrap`: below md a long scale (stages) folds onto a second row
       instead of clipping — every value stays visible and tappable. -->
  <div
    class="border-input bg-background inline-flex max-w-full self-start overflow-hidden rounded-md border max-md:flex-wrap"
    role="group"
    aria-label={ariaLabel ?? label}
  >
    {#each options as option (String(option.value))}
      <button
        type="button"
        class="border-input text-(--txt2) aria-pressed:bg-accent aria-pressed:text-accent-foreground focus-visible:outline-ring bg-background cursor-pointer border-r px-[11px] py-[7px] text-xs whitespace-nowrap last:border-r-0 focus-visible:-outline-offset-2 focus-visible:outline-2 aria-pressed:font-bold max-lg:min-h-11"
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
  {#if hint}<span class="text-muted-foreground text-[11.5px]">{hint}</span>{/if}
</div>
