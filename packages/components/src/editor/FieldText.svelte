<script lang="ts">
  /**
   * A text field, and the contract rule that goes with it: ONE FIELD ↔ ONE EVENT,
   * AT BLUR — never on keystroke, so the history reads as a list of intentions
   * rather than a list of letters.
   *
   * The draft is local; `commit` fires only if the value really changed. The
   * effect re-syncs the draft whenever the store's value moves under us (undo,
   * redo, import) — that is the whole reason the draft cannot simply be `bind:`.
   *
   * An empty string commits as `undefined`: the model has no "empty text", it
   * has an absent field (see `withField` in the store).
   */
  import { untrack } from 'svelte'
  import { te } from '../i18n'
  import type { Language } from '@project-review/core/model/theme'

  interface Props {
    readonly label?: string
    readonly value: string | undefined
    readonly commit: (next: string | undefined) => void
    readonly language: Language
    readonly hint?: string
    /** Character budget of the content model — a counter, never a block. */
    readonly max?: number
    /** Line budget (`risks`, narrative lists) — counted instead of characters. */
    readonly maxLines?: number
    readonly rows?: number
    readonly placeholder?: string
    readonly readonly?: boolean
    readonly ariaLabel?: string
    readonly monospace?: boolean
  }

  let {
    label,
    value,
    commit,
    language,
    hint,
    max,
    maxLines,
    rows,
    placeholder,
    readonly = false,
    ariaLabel,
    monospace = false,
  }: Props = $props()

  // Seeded from the prop ONCE; the effect below owns every later resync.
  // The draft must survive prop echoes of its own commit; a writable
  // $derived would resync (and lose cursor state) on every dispatch
  // round-trip — hence the deliberate $state + $effect pair.
  // eslint-disable-next-line svelte/prefer-writable-derived
  let draft = $state(untrack(() => value) ?? '')

  // External moves (undo / redo / import) win over an untouched draft.
  $effect(() => {
    draft = value ?? ''
  })

  const lineCount = $derived(draft === '' ? 0 : draft.split('\n').length)
  const over = $derived(
    (max !== undefined && draft.length > max) || (maxLines !== undefined && lineCount > maxLines),
  )

  function onblur(): void {
    const next = draft === '' ? undefined : draft
    if (next !== value) commit(next)
  }
</script>

<label class="field">
  {#if label}<span>{label}</span>{/if}
  {#if rows}
    <textarea
      class="textarea"
      class:code={monospace}
      {rows}
      {placeholder}
      {readonly}
      aria-label={ariaLabel ?? label}
      bind:value={draft}
      {onblur}></textarea>
  {:else}
    <input
      class="input"
      type="text"
      {placeholder}
      {readonly}
      aria-label={ariaLabel ?? label}
      bind:value={draft}
      {onblur}
    />
  {/if}
  {#if hint || max !== undefined || maxLines !== undefined}
    <span class="field-footer">
      <span class="hint">{hint ?? ''}</span>
      {#if maxLines !== undefined}
        <span class="counter" class:over>
          {te('editor.counter.lines', language, { n: lineCount, max: maxLines })}
        </span>
      {:else if max !== undefined}
        <span class="counter" class:over>
          {te('editor.counter.chars', language, { n: draft.length, max })}
        </span>
      {/if}
    </span>
  {/if}
</label>
