<script lang="ts">
  /**
   * Rendering of the TextLine micro-format: bold segments + dimmed suffix.
   * The splitting comes entirely from `parseLine` — nothing is re-parsed here.
   * In list context (`bullet`), the line becomes a hanging-indent `<li>`: the 2nd
   * line aligns on the 1st, never under the bullet.
   */
  import { parseLine } from '@project-review/core/model/text-line'

  interface Props {
    readonly text: string
    /** `true` ⇒ bulleted `<li>` with a hanging indent; otherwise an inline `<span>`. */
    readonly bullet?: boolean
  }

  let { text, bullet = false }: Props = $props()

  const line = $derived(parseLine(text))
</script>

<svelte:element this={bullet ? 'li' : 'span'} class="line" class:bullet>
  {#each line.segments as segment, i (i)}{#if segment.bold}<strong>{segment.text}</strong
      >{:else}{segment.text}{/if}{/each}{#if line.suffix}<span class="dim"
      >{` — ${line.suffix}`}</span
    >{/if}
</svelte:element>

<style>
  .line {
    font-size: 12.5px;
    line-height: 1.32;
    color: var(--txt);
  }
  strong {
    font-weight: 700;
    color: var(--txt);
  }
  .dim {
    color: var(--muted);
  }
  .bullet {
    display: block;
    position: relative;
    list-style: none;
    padding: 2.5px 0 2.5px 13px;
  }
  .bullet::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 10px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #b5b5bc;
  }
</style>
