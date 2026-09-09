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
  import { Input } from '../commons/ui/input'
  import { Textarea } from '../commons/ui/textarea'

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

  const counterClass = $derived(
    over
      ? 'text-(--warn) font-bold text-[11px] whitespace-nowrap tabular-nums'
      : 'text-muted-foreground text-[11px] whitespace-nowrap tabular-nums',
  )
</script>

<label class="mb-3.5 flex flex-col last:mb-0">
  {#if label}<span class="text-(--txt2) mb-[5px] text-[12.5px] font-semibold">{label}</span>{/if}
  {#if rows}
    <Textarea
      class={monospace
        ? 'text-(--txt2) field-sizing-fixed bg-[#fafafa] font-mono text-xs leading-[1.55] dark:bg-white/5'
        : 'field-sizing-fixed text-sm leading-[1.4]'}
      {rows}
      {placeholder}
      {readonly}
      aria-label={ariaLabel ?? label}
      bind:value={draft}
      {onblur}
    ></Textarea>
  {:else}
    <Input
      class="read-only:text-(--txt2) read-only:bg-[#fafafa] dark:read-only:bg-white/5"
      type="text"
      {placeholder}
      {readonly}
      aria-label={ariaLabel ?? label}
      bind:value={draft}
      {onblur}
    />
  {/if}
  {#if hint || max !== undefined || maxLines !== undefined}
    <span class="mt-[5px] flex items-baseline justify-between gap-3.5">
      <span class="text-muted-foreground text-[11.5px]">{hint ?? ''}</span>
      {#if maxLines !== undefined}
        <span class={counterClass}>
          {te('editor.counter.lines', language, { n: lineCount, max: maxLines })}
        </span>
      {:else if max !== undefined}
        <span class={counterClass}>
          {te('editor.counter.chars', language, { n: draft.length, max })}
        </span>
      {/if}
    </span>
  {/if}
</label>
