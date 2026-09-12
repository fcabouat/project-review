<script lang="ts">
  /** Milestones tab of the project sheet: the three project dates plus the milestone table, shown by ascending date. */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Milestone, Project } from '@project-review/core/model/project'
  import { isoDate } from '@project-review/core/values/date'
  import { TEXT_CAPACITY, overCapacity } from '@project-review/core/model/budget'
  import { t } from '@project-review/core/services/i18n'
  import type { Language } from '@project-review/core/model/theme'
  import type { ProjectScalarField } from '@project-review/core/events'
  import { te } from '../../i18n'
  import FieldText, { useDrafts } from '../../editor/FieldText.svelte'
  import Icon from '../../commons/Icon.svelte'
  import { Button } from '../../commons/ui/button'
  import { Checkbox } from '../../commons/ui/checkbox'
  import { Input } from '../../commons/ui/input'
  import type { Dispatch } from '../contracts'

  interface Props {
    readonly project: Project
    readonly portfolio: Portfolio
    readonly language: Language
    readonly dispatch: Dispatch
    readonly set: <F extends ProjectScalarField>(field: F, after: Project[F]) => void
  }

  let { project, portfolio, language, dispatch, set }: Props = $props()

  /** Refusal line per date field — a refused date is SAID, not swallowed. */
  let dateErrors = $state<Partial<Record<'start' | 'targetEnd' | 'actualEnd', string>>>({})
  /** Index of the milestone row whose date was refused, and its reason. */
  let milestoneDateError = $state<{ index: number; message: string } | undefined>(undefined)

  /**
   * A date field: the brand constructor decides, and a refusal is reported
   * with the parse's own `invalidDate` wording — the format stores calendar
   * dates only, so committing anything else would write what no reload could
   * read.
   */
  function commitDate(field: 'start' | 'targetEnd' | 'actualEnd', v: string | undefined): void {
    if (v === undefined) {
      dateErrors = { ...dateErrors, [field]: undefined }
      set(field, undefined)
      return
    }
    const when = isoDate(v)
    if (when === undefined) {
      dateErrors = {
        ...dateErrors,
        [field]: te('editor.error.invalidDate', language, { value: v }),
      }
      return
    }
    dateErrors = { ...dateErrors, [field]: undefined }
    set(field, when)
  }

  function setMilestones(after: readonly Milestone[]): void {
    dispatch({ type: 'ChangeProjectMilestones', id: project.id, after })
  }

  /** Milestones are SHOWN by ascending date — entry order carries no meaning. */
  const sortedMilestones = $derived(
    project.milestones
      .map((milestone, index) => ({ milestone, index }))
      .sort((a, b) =>
        a.milestone.date < b.milestone.date ? -1 : a.milestone.date > b.milestone.date ? 1 : 0,
      ),
  )

  function patchMilestone(index: number, patch: Partial<Milestone>): void {
    setMilestones(project.milestones.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  /* ---- the row inputs, and the draft they hold while someone types ---- */

  /** The three texts of a milestone row — the columns of the grid below. */
  type RowField = 'label' | 'date' | 'display'

  /**
   * WHAT IS TYPED IN A ROW AND NOT YET RECORDED. These three columns are not
   * `FieldText`s — this is a five-column grid, with no room for a label or a
   * counter — so they commit at blur off their own input, and the window
   * between the keystroke and the blur is the same one `editor/drafts.ts`
   * describes: unrecorded input the save state must not call « saved » and a
   * closing page must commit.
   *
   * ONE CELL IS THE WHOLE OF IT, because only one of these inputs can ever be
   * mid-edit: taking the focus elsewhere blurs the previous one, which commits
   * it and clears this. Pinned by the built deliverable's smoke run («mid-edit:
   * the milestone label survives the close as well»).
   */
  let typing = $state<{ index: number; field: RowField; raw: string } | undefined>(undefined)

  /** What the model holds for one row column, as text. */
  function held(index: number, field: RowField): string | undefined {
    const milestone = project.milestones[index]
    if (milestone === undefined) return undefined
    return field === 'label'
      ? milestone.label
      : field === 'date'
        ? milestone.date
        : (milestone.display ?? '')
  }

  /**
   * Commits the pending row draft, exactly as a blur does — the one path, so
   * the blur and the closing page cannot record two different things.
   * A REFUSED DATE KEEPS THE DRAFT: the text is genuinely not in the model,
   * the row says why right under it, and forgetting it here would let the
   * save state call the document complete while the entry is still only typed.
   */
  function commitTyping(): void {
    const pending = typing
    if (pending === undefined) return
    const { index, field, raw } = pending
    if (raw === held(index, field)) {
      typing = undefined
      return
    }
    if (field === 'label') {
      patchMilestone(index, { label: raw })
    } else if (field === 'display') {
      patchMilestone(index, { display: raw || undefined })
    } else {
      const when = isoDate(raw)
      if (when === undefined) {
        milestoneDateError = {
          index,
          message: te('editor.error.invalidDate', language, { value: raw }),
        }
        return
      }
      milestoneDateError = undefined
      patchMilestone(index, { date: when })
    }
    typing = undefined
  }

  /** Whether the row draft is something the model has not recorded — compared
   * HERE, eagerly, and NOT as a $derived: the reader is the save strip, above
   * this view, and `project` belongs to the view that mounted this tab, which
   * has nothing to give while it is being left. `FieldText` carries the full
   * reasoning next to its own; `editor/drafts.ts` states the rule. */
  // eslint-disable-next-line svelte/prefer-writable-derived
  let unrecorded = $state(false)
  $effect(() => {
    unrecorded = typing !== undefined && typing.raw !== held(typing.index, typing.field)
  })

  const drafts = useDrafts()
  // Nothing reactive is read here: the two closures are the host's to call.
  $effect(() => drafts?.register({ dirty: () => unrecorded, commit: commitTyping }))

  const MROW = 'grid grid-cols-[1.5fr_1fr_0.9fr_46px_34px] items-center gap-2.5'

  /**
   * THE ONE FRAME OF THIS TAB THAT WAS MEASURED AND NEVER SAID. The timeline
   * label has a visual-capacity budget like every other framed text of the
   * deck (`milestoneLabel`, 40 characters, measured on the printed deck) — and
   * it was the only one in the ladder with no caller at all: this row is a
   * five-column grid, not a `FieldText`, so the counter and the warning that
   * come with that component had nowhere to go.
   *
   * They go HERE, under the row, next to the place the refused date already
   * speaks from — the one line of this table that can carry prose. Said, never
   * refused: the slide clips a long label in its own frame, the value is kept,
   * and the person decides whether to shorten it.
   */
  const LABEL_MAX = TEXT_CAPACITY.milestoneLabel
  const longLabels = $derived(
    new Set(
      project.milestones
        .map((m, index) => (overCapacity('milestoneLabel', m.label) ? index : -1))
        .filter((index) => index >= 0),
    ),
  )
</script>

<section class="bg-background border-border rounded-lg border p-4">
  <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
    {te('editor.sheet.timeAndMilestones', language)}
  </h2>
  <div class="grid grid-cols-1 gap-3.5 md:grid-cols-3">
    <FieldText
      {language}
      label={t('sheet.start', language)}
      value={project.start}
      placeholder={te('editor.review.dateHint', language)}
      error={dateErrors.start}
      commit={(v) => commitDate('start', v)}
    />
    <FieldText
      {language}
      label={t('sheet.targetEnd', language)}
      value={project.targetEnd}
      placeholder={te('editor.review.dateHint', language)}
      error={dateErrors.targetEnd}
      commit={(v) => commitDate('targetEnd', v)}
    />
    <FieldText
      {language}
      label={t('sheet.actualEnd', language)}
      value={project.actualEnd}
      placeholder={te('editor.review.dateHint', language)}
      error={dateErrors.actualEnd}
      commit={(v) => commitDate('actualEnd', v)}
    />
  </div>

  <!-- The milestone rows keep their five columns everywhere: on narrow
       screens the LIST scrolls sideways inside this container (same rule as
       the Projects table — the body never scrolls horizontally). -->
  <div class="mt-3.5 mb-3 overflow-x-auto overscroll-x-contain">
    <div class="min-w-[560px]">
      <div
        class="{MROW} border-border text-muted-foreground border-b px-0.5 pb-[7px] text-[10.5px] font-bold tracking-[0.04em] uppercase"
      >
        <span>{te('editor.sheet.milestoneLabel', language)}</span>
        <span>{te('editor.sheet.milestoneDate', language)}</span>
        <span>{te('editor.sheet.milestoneDisplay', language)}</span>
        <span class="text-center">{te('editor.sheet.milestoneDone', language)}</span>
        <span></span>
      </div>
      {#each sortedMilestones as entry (entry.index)}
        <div class="{MROW} border-border border-b px-0.5 py-[7px] last:border-b-0">
          <!-- Wholesale-replacement rule again: commit at blur ONLY on a real
                   change — `decide` cannot dedup a whole milestones list, so a
                   plain focus/blur would spend the redo stack. `oninput` is
                   not a second commit path: it only makes the draft visible to
                   the host (`commitTyping` above is the one path in). -->
          <Input
            class="h-8 text-[13px]"
            value={entry.milestone.label}
            aria-label={te('editor.sheet.milestoneLabel', language)}
            oninput={(e) =>
              (typing = { index: entry.index, field: 'label', raw: e.currentTarget.value })}
            onblur={commitTyping}
          />
          <!-- A refused milestone date keeps the typed text and says why,
               under the row: the format stores calendar dates only, and a
               silent snap-back reads as the app eating the entry. -->
          <Input
            class="h-8 text-[13px] aria-invalid:border-destructive"
            value={entry.milestone.date}
            placeholder={te('editor.review.dateHint', language)}
            aria-label={te('editor.sheet.milestoneDate', language)}
            aria-invalid={milestoneDateError?.index === entry.index ? 'true' : undefined}
            oninput={(e) =>
              (typing = { index: entry.index, field: 'date', raw: e.currentTarget.value })}
            onblur={commitTyping}
          />
          <Input
            class="h-8 text-[13px]"
            value={entry.milestone.display ?? ''}
            placeholder="—"
            aria-label={te('editor.sheet.milestoneDisplay', language)}
            oninput={(e) =>
              (typing = { index: entry.index, field: 'display', raw: e.currentTarget.value })}
            onblur={commitTyping}
          />
          <span class="flex justify-center">
            <Checkbox
              checked={entry.milestone.done}
              aria-label={te('editor.sheet.milestoneDone', language)}
              onCheckedChange={(done) => patchMilestone(entry.index, { done })}
            />
          </span>
          <span class="flex justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground"
              title={te('editor.projects.delete', language)}
              aria-label={te('editor.projects.delete', language)}
              onclick={() => setMilestones(project.milestones.filter((_, i) => i !== entry.index))}
              ><Icon name="close-line" /></Button
            >
          </span>
        </div>
        <!-- Past its frame: the counter AND what happens, because a number on
             its own is not a message. `status`, not `alert` — nothing was
             refused, the slide will simply clip it. -->
        {#if longLabels.has(entry.index)}
          <p class="text-(--warn) px-0.5 pb-[7px] text-[11.5px]" role="status">
            {te('editor.counter.over', language)}
            {te('editor.counter.chars', language, {
              n: entry.milestone.label.length,
              max: LABEL_MAX,
            })}
          </p>
        {/if}
        {#if milestoneDateError?.index === entry.index}
          <p class="text-destructive px-0.5 pb-[7px] text-[11.5px]" role="alert">
            {milestoneDateError.message}
          </p>
        {/if}
      {:else}
        <p class="text-muted-foreground pt-2 text-[11.5px]">
          {te('editor.sheet.noMilestone', language)}
        </p>
      {/each}
    </div>
  </div>

  {#if project.milestones.length < 6}
    <Button
      variant="outline"
      size="sm"
      onclick={() =>
        setMilestones([
          ...project.milestones,
          // Born empty: the display does the "—" fallback.
          { label: '', date: portfolio.review.reviewDate, done: false },
        ])}>{te('editor.sheet.addMilestone', language)}</Button
    >
  {:else}
    <p class="text-muted-foreground text-[11.5px]">{te('editor.sheet.milestonesFull', language)}</p>
  {/if}
  <p class="text-muted-foreground mt-2 text-[11.5px]">
    {te('editor.sheet.milestonesSorted', language)}
  </p>
</section>
