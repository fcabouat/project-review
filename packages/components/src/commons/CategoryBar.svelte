<script lang="ts">
  /**
   * Bar of one category (D1 dashboard): three segments in life-cycle order —
   * pre-project (tint at 25 %), in progress (full tint), done (white with a tint
   * outline). The scale is shared by every bar: 1 project = `pxPerProject`,
   * otherwise comparing two categories makes no sense any more.
   * The color arrives already resolved by the parent (`--cat`, via `catColor`).
   */
  import type { CategoryBar } from '@project-review/core/projections'

  interface Props {
    readonly bar: CategoryBar
    /** 489 px for 4 projects in the mockup. */
    readonly pxPerProject?: number
  }

  let { bar, pxPerProject = 122.25 }: Props = $props()

  const segments = $derived(
    (
      [
        ['av', bar.preProject],
        ['en', bar.inProgress],
        ['fi', bar.done],
      ] as const
    ).filter(([, n]) => n > 0),
  )
</script>

<div class="cat-bar">
  {#each segments as [kind, n] (kind)}
    <i class="sg-{kind}" style:width="{n * pxPerProject}px"></i>
  {/each}
</div>

<style>
  .cat-bar {
    /* Fallback if the parent has not resolved the color: never an invisible segment. */
    --tint: var(--cat, var(--accent));
    height: 27px;
    display: flex;
    border-radius: 4px;
    overflow: hidden;
  }
  .cat-bar i {
    display: block;
    height: 100%;
    flex: none;
  }
  .sg-en {
    background: var(--tint);
  }
  /* tint at 25 % on white — equivalent to the mockup's rgba(tint,.25) */
  .sg-av {
    background: color-mix(in srgb, var(--tint) 25%, #fff);
  }
  .sg-fi {
    background: #fff;
    border: 1.5px solid var(--tint);
  }
</style>
