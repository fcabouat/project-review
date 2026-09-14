<script lang="ts">
  import { untrack } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { ParseError } from '@project-review/core/services/parse'
  import {
    IMPORT_BLOCKS,
    IMPORT_COLLECTIONS,
    emptyImportSelection,
    importSummary,
    mixPortfolio,
    sameImportValue,
    type ImportBlock,
    type ImportCollection,
    type ImportSelection,
  } from '@project-review/core/services/portfolio-import'
  import {
    readImportJson,
    type ImportReading,
  } from '@project-review/core/services/parse/import-file'
  import { MAX_CHARS, MAX_ENTITIES, MAX_IMPORT_BYTES } from '@project-review/core/model/budget'
  import { verdict, type Refusal } from '@project-review/core/commands'
  import {
    ERROR_REPORT_FILE_NAME,
    errorReportText,
    isTruncated,
    shownErrors,
  } from '../error-report'
  import type { Dispatch } from '../../contracts'
  import { te, type LabelKey } from '../../i18n'
  import { Button } from '../../commons/ui/button'
  import { Checkbox } from '../../commons/ui/checkbox'
  import { Textarea } from '../../commons/ui/textarea'
  import * as RadioGroup from '../../commons/ui/radio-group'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    readonly close: () => void
    readonly prefill?: string
    readonly prefillMode?: 'replace' | 'merge'
  }
  let { portfolio, dispatch, close, prefill, prefillMode }: Props = $props()
  let mode = $state<'replace' | 'merge'>(untrack(() => prefillMode ?? 'replace'))
  let text = $state('')
  let dragging = $state(false)
  let result = $state<ImportReading | undefined>()
  let selected = $state<ImportSelection>(emptyImportSelection())
  let expanded = $state<Record<ImportCollection, boolean>>({
    categories: true,
    projects: false,
    freeSlides: false,
  })
  let readFailed = $state(false)
  let reading = $state(false)
  // A late file read must not replace a newer pasted/dropped input.
  let readEpoch = 0
  const language = $derived(portfolio.settings.language)
  const source = $derived(result?.ok ? result.source : undefined)
  const incoming = $derived(source?.portfolio)

  function analyse(value: string): void {
    readEpoch += 1
    reading = false
    readFailed = false
    text = value
    result = value.trim() === '' ? undefined : readImportJson(value)
    selected = emptyImportSelection()
    if (result?.ok && result.source.kind === 'appearance') {
      mode = 'merge'
      selected = {
        ...selected,
        blocks: Object.values(result.source.portfolio.settings.identity).some(Boolean)
          ? ['identity', 'theme']
          : ['theme'],
        categories: result.source.portfolio.categories.map((x) => x.id),
      }
    }
  }
  const opening = untrack(() => prefill)
  if (opening !== undefined) analyse(opening)

  const candidate = $derived(
    source === undefined
      ? undefined
      : mode === 'replace' && source.kind === 'portfolio'
        ? source.portfolio
        : mixPortfolio(portfolio, source, selected),
  )
  const summary = $derived(
    candidate === undefined ? undefined : importSummary(portfolio, candidate),
  )
  const changed = $derived(
    summary !== undefined &&
      (summary.added + summary.replaced + summary.removed > 0 ||
        summary.blocks.length > 0 ||
        (mode === 'replace' && candidate !== undefined && !sameImportValue(portfolio, candidate))),
  )
  const command = $derived(
    candidate === undefined
      ? undefined
      : {
          type: 'ReplacePortfolio' as const,
          portfolio: candidate,
        },
  )
  const outcome = $derived(command === undefined ? undefined : verdict(portfolio, command))
  const REFUSAL_KEY: Readonly<Record<Refusal, LabelKey>> = {
    overBudget: 'editor.io.refusedBudget',
    noEffect: 'editor.io.mixNoEffect',
    offContract: 'editor.io.refusedContract',
  }
  const refusalLine = $derived(
    outcome && !outcome.ok
      ? te(REFUSAL_KEY[outcome.refusal], language, {
          entities: MAX_ENTITIES,
          chars: MAX_CHARS / 1_000_000,
        })
      : !changed && source
        ? te('editor.io.mixNoEffect', language)
        : undefined,
  )

  function blockChecked(key: ImportBlock, on: boolean): void {
    selected = {
      ...selected,
      blocks: on ? [...selected.blocks, key] : selected.blocks.filter((x) => x !== key),
    }
  }
  function collectionChecked(key: ImportCollection, ids: readonly string[], on: boolean): void {
    const next = new SvelteSet(selected[key])
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    selected = { ...selected, [key]: [...next] }
  }
  function itemState(
    key: ImportCollection,
    item: { readonly id: string },
  ): 'added' | 'replaced' | 'same' {
    const current = portfolio[key].find((x) => x.id === item.id)
    return current === undefined ? 'added' : sameImportValue(current, item) ? 'same' : 'replaced'
  }
  const errorMessage = (error: ParseError): string =>
    te(`editor.error.${error.code}`, language, error.params)

  async function readFile(file: File | undefined): Promise<void> {
    if (!file) return
    const epoch = ++readEpoch
    readFailed = false
    result = undefined
    text = ''
    if (file.size > MAX_IMPORT_BYTES) {
      reading = false
      result = { ok: false, refusal: 'tooLarge' }
      return
    }
    reading = true
    try {
      const value = await file.text()
      if (epoch === readEpoch) analyse(value)
    } catch {
      if (epoch === readEpoch) {
        reading = false
        readFailed = true
      }
    }
  }
  function downloadReport(): void {
    if (!result || result.ok || 'refusal' in result) return
    const url = URL.createObjectURL(
      new Blob([errorReportText(result.errors, errorMessage)], { type: 'text/plain' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = ERROR_REPORT_FILE_NAME
    link.click()
    URL.revokeObjectURL(url)
  }
  function confirmImport(): void {
    if (!changed || !command || reading) return
    if (dispatch(command) !== undefined) close()
  }
</script>

<div class="p-5">
  <div
    class="text-muted-foreground bg-secondary border-input mb-3 rounded-lg border border-dashed p-5 text-center text-[13px]"
    class:ring-2={dragging}
    role="presentation"
    ondragover={(e) => {
      e.preventDefault()
      dragging = true
    }}
    ondragleave={() => (dragging = false)}
    ondrop={(e) => {
      e.preventDefault()
      dragging = false
      void readFile(e.dataTransfer?.files[0])
    }}
  >
    {te('editor.io.dropzone', language)}
    <label class="text-primary ml-1.5 cursor-pointer font-semibold underline">
      {te('editor.io.browse', language)}
      <input
        class="sr-only"
        type="file"
        accept=".json,application/json"
        onchange={(e) => void readFile(e.currentTarget.files?.[0])}
      />
    </label>
  </div>
  <Textarea
    class="field-sizing-fixed font-mono text-xs"
    rows={4}
    aria-label={te('editor.io.paste', language)}
    value={text}
    oninput={(e) => analyse(e.currentTarget.value)}
  />
  {#if reading}<p role="status" class="mt-2 text-sm">{te('editor.io.reading', language)}</p>{/if}
  {#if readFailed}<p role="alert" class="text-destructive mt-2 text-sm">
      {te('editor.io.readFailed', language)}
    </p>{/if}

  {#if result && !result.ok}
    <div class="bg-secondary mt-3 rounded-md p-3" role="alert">
      {#if 'refusal' in result}
        <p class="text-destructive font-semibold">
          {te('editor.io.refused', language)} — {te(`editor.error.${result.refusal}`, language)}
        </p>
      {:else}
        <p class="text-destructive font-semibold">
          {te('editor.io.errorCount', language, { n: result.errors.length })}
        </p>
        <ul class="mt-2 max-h-[190px] overflow-auto pl-4 text-sm">
          {#each shownErrors(result.errors) as error, i (i)}
            <li>{error.path ? error.path + ' : ' : ''}{errorMessage(error)}</li>
          {/each}
        </ul>
        {#if isTruncated(result.errors)}
          <p class="mt-2 text-xs">
            {te('editor.io.errorListCapped', language, { n: shownErrors(result.errors).length })}
          </p>
          <Button variant="outline" size="sm" onclick={downloadReport}
            >{te('editor.io.errorReport', language)}</Button
          >
        {/if}
      {/if}
    </div>
  {/if}

  {#if source && incoming}
    <p class="text-(--ok) mt-3 text-sm font-semibold">
      {source.kind === 'appearance'
        ? te('editor.io.profileDetected', language)
        : te('editor.io.reportOk', language, {
            projects: incoming.projects.length,
            categories: incoming.categories.length,
            slides: incoming.freeSlides.length,
          })}
    </p>
    <fieldset class="border-border mt-3 rounded-md border p-3">
      <legend class="px-1 text-sm font-semibold">{te('editor.io.modeLegend', language)}</legend>
      <RadioGroup.Root
        value={mode}
        onValueChange={(v) => (mode = v as 'replace' | 'merge')}
        class="flex flex-col gap-2"
      >
        <label class="flex items-start gap-2 text-sm">
          <RadioGroup.Item value="replace" disabled={source.kind === 'appearance'} />
          <span>{te('editor.io.mode.replace', language)}</span>
        </label>
        <label class="flex items-start gap-2 text-sm">
          <RadioGroup.Item value="merge" />
          <span>{te('editor.io.mode.merge', language)}</span>
        </label>
      </RadioGroup.Root>
      {#if source.kind === 'appearance'}
        <p class="text-muted-foreground mt-2 text-xs">{te('editor.io.profileSafe', language)}</p>
      {/if}
    </fieldset>

    {#if mode === 'merge'}
      <p class="text-muted-foreground mt-3 text-xs">{te('editor.io.mixHint', language)}</p>
      <fieldset class="border-border mt-2 rounded-md border p-3">
        <legend class="px-1 text-sm font-semibold">{te('editor.io.blocks', language)}</legend>
        <div class="grid gap-2 sm:grid-cols-2">
          {#each IMPORT_BLOCKS.filter((key) => key !== 'review' || source.kind === 'portfolio') as key (key)}
            <label class="flex items-start gap-2 text-sm">
              <Checkbox
                checked={selected.blocks.includes(key)}
                onCheckedChange={(on) => blockChecked(key, on)}
              />
              <span>{te(`editor.io.block.${key}`, language)}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      {#each IMPORT_COLLECTIONS.filter((key) => key === 'categories' || source.kind === 'portfolio') as key (key)}
        {@const items = incoming[key]}
        {@const ids = items.map((x) => x.id)}
        {@const count = ids.filter((id) => selected[key].includes(id)).length}
        <details class="border-border mt-2 rounded-md border p-3" bind:open={expanded[key]}>
          <summary class="cursor-pointer text-sm font-semibold"
            >{te(`editor.io.collection.${key}`, language)} — {count} / {items.length}</summary
          >
          {#if items.length > 0}
            <label class="mt-2 flex items-center gap-2 text-sm font-semibold">
              <Checkbox
                checked={count === ids.length}
                indeterminate={count > 0 && count < ids.length}
                onCheckedChange={(on) => collectionChecked(key, ids, on)}
              />
              <span>{te('editor.io.selectAll', language)}</span>
            </label>
            <div class="mt-2 max-h-48 space-y-2 overflow-auto">
              {#each items as item (item.id)}
                {@const status = itemState(key, item)}
                <label class="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={selected[key].includes(item.id)}
                    onCheckedChange={(on) => collectionChecked(key, [item.id], on)}
                  />
                  <span class="min-w-0 break-words">
                    <b>{item.id}</b> · {'name' in item ? item.name : item.title}
                    <span class="text-muted-foreground text-xs">
                      — {te(`editor.io.item.${status}`, language)}</span
                    >
                  </span>
                </label>
              {/each}
            </div>
          {/if}
        </details>
      {/each}
    {/if}

    {#if summary}
      <section
        class="bg-secondary mt-3 rounded-md p-3"
        aria-label={te('editor.io.previewChanges', language)}
      >
        <p class="text-sm font-semibold">{te('editor.io.previewChanges', language)}</p>
        {#if mode === 'replace'}<p class="mt-1 text-sm">
            {te('editor.io.replaceHint', language)}
          </p>{/if}
        <p class="mt-1 text-sm">
          {te('editor.io.changeCounts', language, {
            added: summary.added,
            replaced: summary.replaced,
            removed: summary.removed,
          })}
        </p>
        {#if summary.blocks.length > 0}
          <p class="mt-1 text-sm">
            {summary.blocks.map((key) => te(`editor.io.block.${key}`, language)).join(' · ')}
          </p>
        {/if}
        {#if summary.reordered.length > 0}
          <p class="mt-1 text-sm">
            {te('editor.io.reordered', language, {
              collections: summary.reordered
                .map((key) => te(`editor.io.collection.${key}`, language))
                .join(' · '),
            })}
          </p>
        {/if}
        {#if summary.missingCategories.length > 0}
          <p class="text-(--warn) mt-2 text-sm" role="status">
            {te('editor.io.missingCategories', language, {
              ids: summary.missingCategories.join(', '),
            })}
          </p>
        {/if}
      </section>
    {/if}
    {#if refusalLine}<p class="text-(--warn) mt-2 text-sm" role="status">{refusalLine}</p>{/if}
  {/if}
  <div class="mt-4 flex flex-wrap justify-end gap-2.5">
    <Button variant="outline" onclick={close}>{te('editor.io.cancel', language)}</Button>
    <Button disabled={!changed || outcome?.ok !== true || reading} onclick={confirmImport}>
      {te(mode === 'merge' ? 'editor.io.applyMix' : 'editor.io.replace', language)}
    </Button>
  </div>
</div>
