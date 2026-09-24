<script lang="ts">
  import { untrack } from 'svelte'
  import type { Language } from '@project-review/core/model/theme'
  import {
    orderedScopeTags,
    scopeTagsFromText,
    validScopeTags,
  } from '@project-review/core/values/scope-tags'
  import { te } from '../i18n'
  import { Input } from '../commons/ui/input'
  import { Button } from '../commons/ui/button'
  import { useDrafts } from './FieldText.svelte'

  interface Props {
    readonly value: readonly string[] | undefined
    readonly suggestions?: readonly string[]
    readonly draftKey: string
    readonly language: Language
    readonly commit: (next: readonly string[] | undefined) => boolean
  }

  let { value, suggestions = [], draftKey, language, commit }: Props = $props()
  const drafts = useDrafts()
  const tags = $derived(orderedScopeTags(value))
  const base = $derived(JSON.stringify(value ?? []))
  const inputId = $props.id()
  let container: HTMLDivElement | undefined = $state()
  // Preserve typing across checkpoint echoes; only model/recovery changes resync the input.
  // eslint-disable-next-line svelte/prefer-writable-derived
  let draft = $state('')
  let attempted = $state(false)
  let refused = $state(false)
  const parsed = $derived(scopeTagsFromText(draft))
  const combined = $derived(parsed === undefined ? undefined : [...new Set([...tags, ...parsed])])
  const valid = $derived(combined !== undefined && validScopeTags(combined))
  const available = $derived(
    orderedScopeTags(suggestions)
      .filter(
        (tag) =>
          !tags.includes(tag) &&
          tag.includes(draft.trim().toLowerCase().replace(/_/g, '-').replace(/^#/, '')),
      )
      .slice(0, 8),
  )

  $effect(() => {
    draft = drafts?.recover?.(draftKey, base) ?? ''
  })
  $effect(() => {
    drafts?.checkpoint?.(draftKey, base, draft === '' ? undefined : draft)
  })

  // Keep partial text checkpointed when a chip is removed or a suggestion is added.
  function update(next: readonly string[], remainder = draft): void {
    next = orderedScopeTags(next)
    refused = false
    if (JSON.stringify(next) !== base && !commit(next.length ? next : undefined)) {
      refused = true
      return
    }
    draft = remainder
    drafts?.checkpoint?.(draftKey, JSON.stringify(next), remainder === '' ? undefined : remainder)
  }

  function add(): void {
    if (!draft.trim()) return
    attempted = true
    if (valid && combined !== undefined) {
      update(combined, '')
      attempted = false
    }
  }

  // The registry reads an eager flag, never props from a potentially unmounted sheet.
  // eslint-disable-next-line svelte/prefer-writable-derived
  let dirty = $state(false)
  $effect(() => {
    dirty = draft !== ''
  })
  $effect(() => untrack(() => drafts?.register({ dirty: () => dirty, commit: add })))

  const saveState = $derived(drafts?.getSaveState?.(draftKey, dirty))
</script>

<div class="mb-3.5 min-w-0" bind:this={container}>
  <label for={inputId} class="text-(--txt2) mb-[5px] block text-[12.5px] font-semibold">
    {te('editor.field.scopeTags', language)}
  </label>
  {#if tags.length}
    <ul class="mb-2 flex list-none flex-wrap gap-1.5 p-0">
      {#each tags as tag (tag)}
        <li
          class="bg-primary/10 text-primary inline-flex max-w-full items-center rounded-md pl-2 text-xs"
        >
          <span class="break-all">{tag}</span>
          <button
            type="button"
            class="hover:bg-primary/10 focus-visible:outline-ring ml-1 rounded px-2 py-1 text-base focus-visible:outline-2"
            aria-label={te('editor.scopeTags.remove', language, { tag })}
            onclick={() => update(tags.filter((item) => item !== tag))}>×</button
          >
        </li>
      {/each}
    </ul>
  {/if}
  <div class="flex min-w-0 gap-2">
    <Input
      id={inputId}
      name={draftKey}
      autocomplete="off"
      autocapitalize="none"
      spellcheck={false}
      class="min-w-0 flex-1"
      placeholder="#tag1, #tag2"
      aria-describedby="{inputId}-hint"
      aria-invalid={attempted && !valid ? 'true' : undefined}
      bind:value={draft}
      onblur={(event) => {
        if (!(event.relatedTarget instanceof Node && container?.contains(event.relatedTarget)))
          add()
      }}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ',') {
          event.preventDefault()
          add()
        }
      }}
    />
    <Button variant="outline" size="sm" onclick={add} disabled={!draft.trim()}>
      {te('editor.scopeTags.add', language)}
    </Button>
  </div>
  <p id="{inputId}-hint" class="text-muted-foreground mt-1 text-[11.5px]">
    {te('editor.hint.scopeTags', language)}
  </p>
  {#if attempted && !valid}
    <p role="alert" class="text-destructive mt-1 text-xs">
      {te('editor.scopeTags.invalid', language)}
    </p>
  {/if}
  {#if refused}<p role="alert" class="text-destructive mt-1 text-xs">
      {te('editor.scopeTags.refused', language)}
    </p>{/if}
  {#if dirty && saveState}
    <p class="text-muted-foreground mt-1 text-[11px]" aria-live="polite">
      {te(`editor.save.${saveState}`, language)}
    </p>
  {/if}
  {#if available.length}
    <div class="mt-2 flex flex-wrap items-center gap-1.5">
      <span class="text-muted-foreground text-[11.5px]"
        >{te('editor.scopeTags.suggestions', language)}</span
      >
      {#each available as tag (tag)}
        <button
          type="button"
          disabled={tags.length >= 32}
          class="border-border hover:bg-muted focus-visible:outline-ring rounded-md border px-2 py-1 text-xs focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
          onclick={() => {
            const next = [...new Set([...tags, tag])]
            if (validScopeTags(next)) update(next, '')
          }}>{tag}</button
        >
      {/each}
    </div>
  {/if}
</div>
