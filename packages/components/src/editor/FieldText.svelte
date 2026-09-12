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
   * CLEARING A FIELD COMMITS WHAT THAT FIELD'S MODEL CALLS "cleared", and the
   * two are not the same. Most fields are OPTIONAL: the model has no "empty
   * text" for them, it has an absent field, so an empty box commits
   * `undefined` and `withField` drops the key. A handful are REQUIRED —
   * `review.title`, `identity.org`, `identity.unit` — and their model type is
   * `string`: the contract accepts `''` (the parse reads it through `str`, a
   * blank start ships `org: ''`), and it is the ABSENCE it refuses. Committing
   * `undefined` there produced a command the gate refused in silence: the box
   * looked empty, the model still held the old value, and nothing said so.
   * {@link Props.required} is which of the two this field is.
   *
   * A TEXT PAST ITS FRAME IS SAID TOO, AND NEVER REFUSED. The caller names the
   * FRAME (`capacity`), not a number, and the verdict comes from the core's
   * `overCapacity` — the VISUAL-CAPACITY budget of `model/budget.ts`: what the
   * slide's frame was measured to hold, not what the file format allows. Over
   * it, the counter turns AND a line says what happens — the slide will clip
   * the text — because a coloured number is not a message. The value is still
   * committed: refusing a paste would lose the user's words, which is the
   * worse failure of the two.
   *
   * REFUSED INPUT IS SAID, NOT SWALLOWED. Some fields carry a rule the file
   * format enforces (a font charset, a calendar date): when the caller refuses
   * a value it passes `error`, and the field shows it under the input, marks
   * the input `aria-invalid` and KEEPS the typed text — so the person sees
   * what was refused and why, instead of watching their entry disappear or,
   * worse, be stored in a form the next reload cannot read.
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
  // eslint-disable-next-line svelte/prefer-writable-derived
  let draft = $state(untrack(() => value) ?? '')

  // External moves (undo / redo / import) win over an untouched draft.
  $effect(() => {
    draft = value ?? ''
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

  function onblur(): void {
    // `required` decides what "cleared" MEANS for this field — the empty
    // string where the model has no absence, the absence everywhere else.
    const next = draft === '' && !required ? undefined : draft
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
      aria-invalid={error ? 'true' : undefined}
      bind:value={draft}
      {onblur}
    ></Textarea>
  {:else}
    <Input
      class="read-only:text-(--txt2) read-only:bg-[#fafafa] aria-invalid:border-destructive dark:read-only:bg-white/5"
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
