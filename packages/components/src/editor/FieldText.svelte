<script lang="ts" module>
  import { getContext, setContext } from 'svelte'
  import type { DraftRegistry } from './drafts'

  /**
   * Where a shell publishes its pending-draft registry, so that a field four
   * views down can announce what it is holding without a prop threaded
   * through every one of them — the same seam, and for the same reason, as
   * the slideshow opener. What the registry is FOR, and the two things that
   * depend on it, are in `drafts.ts`.
   */
  const DRAFTS = Symbol('editor.drafts')

  /** Called by the shell at init. `undefined` is a shell with no host behind
   * it — a story — and the fields under it simply register nowhere. */
  export function provideDrafts(registry: DraftRegistry | undefined): void {
    setContext(DRAFTS, registry)
  }

  /** The host's registry, or `undefined` outside such a shell. */
  export function useDrafts(): DraftRegistry | undefined {
    return getContext<DraftRegistry | undefined>(DRAFTS)
  }
</script>

<script lang="ts">
  /**
   * Local draft; one commit at blur, synchronized on external model changes.
   * The registry exposes pending input and commits it on pagehide.
   * Required model strings clear to ''; optional strings clear to undefined.
   * Capacity warnings never discard text; refused input remains visible with an error.
   */
  import { untrack } from 'svelte'
  import { te } from '../i18n'
  import type { Language } from '@project-review/core/model/theme'
  import type { CapacityField } from '@project-review/core/model/budget'
  import { TEXT_CAPACITY, overCapacity } from '@project-review/core/model/budget'
  import { Input } from '../commons/ui/input'
  import { Textarea } from '../commons/ui/textarea'

  interface Props {
    readonly label?: string
    /** Stable model address, independent of translated labels and render order. */
    readonly draftKey?: string
    readonly compact?: boolean
    readonly value: string | undefined
    readonly commit: (next: string | undefined) => void
    readonly language: Language
    readonly hint?: string
    /** Set by the caller when it REFUSED the last commit: the rule, in the
     * reader's language. Shown under the field; the typed text stays. */
    readonly error?: string
    /**
     * `true` when the MODEL has no absent state for this field — its type is
     * `string`, not `string | undefined`. Emptying the box then commits the
     * empty string, which the contract accepts, instead of the absence it
     * refuses. The default is the optional field, which is most of them.
     */
    readonly required?: boolean
    /** The FRAME the whole value is drawn in — the core names it, measures it
     * and judges it (`TEXT_CAPACITY`, `overCapacity`). A counter and a
     * warning, never a block. */
    readonly capacity?: CapacityField
    /**
     * Line budget (`risks`, narrative lists) — counted instead of characters.
     * A number, not a frame: the capacity ladder measures CHARACTERS, and no
     * line count was ever measured for the core to state. It is therefore
     * EDITORIAL ADVICE, and the caller is where it is justified — see
     * `NarrativeTab`, the only caller, which names both of its numbers and
     * says what they are. Like every other budget here it is SAID and never
     * refused.
     */
    readonly maxLines?: number
    /** The frame ONE LINE is drawn in, where each line gets its own (a
     * narrative bullet). Judged per line, alongside {@link maxLines}. */
    readonly lineCapacity?: CapacityField
    readonly rows?: number
    readonly placeholder?: string
    readonly readonly?: boolean
    readonly ariaLabel?: string
    readonly monospace?: boolean
  }

  let {
    label,
    draftKey,
    compact = false,
    value,
    commit,
    language,
    hint,
    error,
    required = false,
    capacity,
    maxLines,
    lineCapacity,
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
  let draft = $state(untrack(() => value) ?? '')
  const drafts = useDrafts()
  const checkpointBase = $derived(value ?? '')

  // External moves (undo / redo / import) win over an untouched draft.
  $effect(() => {
    const base = value ?? ''
    draft =
      (draftKey === undefined ? undefined : drafts?.recover?.(draftKey, checkpointBase)) ?? base
  })
  $effect(() => {
    if (draftKey !== undefined)
      drafts?.checkpoint?.(draftKey, checkpointBase, draft !== (value ?? '') ? draft : undefined)
  })

  const lines = $derived(draft === '' ? [] : draft.split('\n'))
  const lineCount = $derived(lines.length)
  /** What the frame holds, for the counter to show. The verdict below is the
   * core's, not a second reading of this number. */
  const max = $derived(capacity === undefined ? undefined : TEXT_CAPACITY[capacity])
  const over = $derived(
    (capacity !== undefined && overCapacity(capacity, draft)) ||
      (maxLines !== undefined && lineCount > maxLines) ||
      (lineCapacity !== undefined && lines.some((l) => overCapacity(lineCapacity, l))),
  )

  /** What leaving the field would commit. `required` decides what "cleared"
   * MEANS here — the empty string where the model has no absence, the absence
   * everywhere else. */
  function pendingValue(): string | undefined {
    return draft === '' && !required ? undefined : draft
  }

  function onblur(): void {
    const next = pendingValue()
    if (next !== value) commit(next)
  }

  /**
   * Whether this field is holding something the model has not recorded —
   * compared HERE, in this component's own reactive context, and read by the
   * host as a plain boolean.
   *
   * A $derived IS EXACTLY WHAT THIS MUST NOT BE, and the rule below is waived
   * on that ground. A derived is evaluated by whoever READS it, and its reader
   * is the save strip, above this view in the tree. `value` reaches into the
   * view that mounted this field (`project.name`, on the sheet screen), and
   * that view has nothing to give the moment its own route stops matching —
   * so the strip's render would raise the view's error, in the very update
   * that was about to remove this entry, and the registry would stay poisoned.
   * An EAGER effect pays that comparison here, where a destroyed branch simply
   * does not re-run it, and hands the strip a value it can only read.
   * `drafts.ts` states the rule; the built deliverable's smoke run is where a
   * regression surfaces (a sheet left for another screen, zero console errors).
   */
  // eslint-disable-next-line svelte/prefer-writable-derived
  let unrecorded = $state(false)
  $effect(() => {
    unrecorded = pendingValue() !== value
  })

  // Registered for the length of the mounting, and NOTHING reactive is read
  // in here: the entry's two closures are called by the HOST — the strip that
  // asks `dirty`, the closing page that asks `commit` — so this effect runs
  // once, on mount, and tears down on unmount.
  $effect(() => drafts?.register({ dirty: () => unrecorded, commit: onblur }))

  const counterClass = $derived(
    over
      ? 'text-(--warn) font-bold text-[11px] whitespace-nowrap tabular-nums'
      : 'text-muted-foreground text-[11px] whitespace-nowrap tabular-nums',
  )
</script>

<label class={compact ? 'flex min-w-0 flex-col' : 'mb-3.5 flex flex-col last:mb-0'}>
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
      aria-invalid={error ? 'true' : undefined}
      bind:value={draft}
      {onblur}
    ></Textarea>
  {:else}
    <Input
      class="read-only:text-(--txt2) read-only:bg-[#fafafa] aria-invalid:border-destructive dark:read-only:bg-white/5 {compact
        ? 'h-8 text-[13px]'
        : ''}"
      type="text"
      {placeholder}
      {readonly}
      aria-label={ariaLabel ?? label}
      aria-invalid={error ? 'true' : undefined}
      bind:value={draft}
      {onblur}
    />
  {/if}
  {#if error}
    <span class="text-destructive mt-[5px] text-[11.5px]" role="alert">{error}</span>
  {/if}
  <!-- The overrun, in words. `role="status"` and not `alert`: nothing was
       refused and nothing is lost — the slide will simply clip what does not
       fit, and the person decides whether to shorten it. -->
  {#if over}
    <span class="text-(--warn) mt-[5px] text-[11.5px]" role="status">
      {te('editor.counter.over', language)}
    </span>
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
