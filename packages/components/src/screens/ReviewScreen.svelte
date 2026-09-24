<script lang="ts">
  import { newId } from '../editor/new-id'
  /**
   * Review screen — the review's own fields, plus the free slides anchored to
   * it.
   *
   * The card reads as a key/value list where every line is the editable field
   * it stands for, since the editor is the only place these values can be
   * typed. One field ↔ one `ChangeReviewField` command, at blur —
   * `decide` reads the `before` and drops the no-ops.
   *
   * Pure screen: `portfolio` and `dispatch` in, nothing else — no store, no
   * router, no infrastructure (screens contract, `contracts.ts`).
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { ReviewField } from '@project-review/core/events'
  import { freeSlideId } from '@project-review/core/values/ids'
  import type { FreeSlide } from '@project-review/core/model/free-slide'
  import { isoDate } from '@project-review/core/values/date'
  import { te } from '../i18n'
  import FieldText from '../editor/FieldText.svelte'
  import FreeSlideCard from '../editor/FreeSlideCard.svelte'
  import Icon from '../commons/Icon.svelte'
  import { Button } from '../commons/ui/button'
  import SlidePreviewDialog from '../editor/SlidePreviewDialog.svelte'
  import type { Dispatch } from './contracts'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    readonly readOnly?: boolean
  }

  let { portfolio, dispatch, readOnly = false }: Props = $props()

  const review = $derived(portfolio.review)
  const language = $derived(portfolio.settings.language)

  /**
   * Refusal line of each date field, per field — a refused date must be SAID,
   * not swallowed: the entry is not committed (the format only stores calendar
   * dates), so without a message the text would simply seem to vanish.
   */
  let dateErrors = $state<Partial<Record<ReviewField, string>>>({})

  /** One text field of the review — `reviewDate` is the only mandatory one (law 1). */
  function change(field: ReviewField, next: string | undefined): void {
    if (field === 'reviewDate' || field === 'previousReviewDate') {
      const when = next === undefined ? undefined : isoDate(next)
      // The review date is the reference of every derivation: it is never
      // cleared; both date fields refuse anything the brand refuses — the
      // same rule, and the same wording, as the strict parse's `invalidDate`.
      if (next !== undefined && when === undefined) {
        dateErrors = {
          ...dateErrors,
          [field]: te('editor.error.invalidDate', language, { value: next }),
        }
        return
      }
      if (field === 'reviewDate' && when === undefined) {
        dateErrors = { ...dateErrors, [field]: te('editor.review.dateRequired', language) }
        return
      }
      dateErrors = { ...dateErrors, [field]: undefined }
      dispatch({ type: 'ChangeReviewField', field, after: when } as never)
      return
    }
    dispatch({ type: 'ChangeReviewField', field, after: next } as never)
  }

  /** Mounted only while open: a closed preview renders no slide at all. */
  let previewingTitle = $state(false)

  const slides = $derived(portfolio.freeSlides)

  function addSlide(): void {
    // Born empty: the display does the "—" fallback, the data stays honest.
    const slide: FreeSlide = {
      id: freeSlideId(newId())!,
      anchor: { type: 'opening' },
      title: '',
      blocks: [[]],
    }
    dispatch({ type: 'CreateFreeSlide', slide, index: portfolio.freeSlides.length })
  }

  /** Position determines placement in the deck; arrows order slides at that position. */
  function neighbourOf(slide: FreeSlide, delta: -1 | 1): FreeSlide | undefined {
    const siblings = slides.filter((s) => JSON.stringify(s.anchor) === JSON.stringify(slide.anchor))
    return siblings[siblings.indexOf(slide) + delta]
  }

  function moveSlide(slide: FreeSlide, delta: -1 | 1): void {
    const neighbour = neighbourOf(slide, delta)
    if (!neighbour) return
    dispatch({
      type: 'MoveFreeSlide',
      id: slide.id,
      to: portfolio.freeSlides.indexOf(neighbour),
    })
  }
</script>

<div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
  <div class="flex min-w-0 flex-col gap-4">
    <section class="bg-background border-border rounded-lg border p-4">
      <h2
        class="text-primary mb-3 flex items-center justify-between text-xs font-bold tracking-[0.06em] uppercase"
      >
        {te('editor.review.title', language)}
        <Button
          variant="ghost"
          size="icon-xs"
          class="text-muted-foreground"
          title={te('editor.preview.titleSlide', language)}
          aria-label={te('editor.preview.titleSlide', language)}
          onclick={() => (previewingTitle = true)}><Icon name="eye-line" /></Button
        >
      </h2>
      <!-- `required`: the review title's model type is `string` — emptying
           the box stores the empty string, which the contract accepts, not an
           absence it would refuse in silence. -->
      <fieldset disabled={readOnly} class="contents">
        <FieldText
          {language}
          label={te('editor.field.title', language)}
          draftKey="review.title"
          value={review.title}
          commit={(v) => change('title', v)}
          required
          capacity="reviewTitle"
        />
        <FieldText
          {language}
          label={te('editor.field.subtitle', language)}
          draftKey="review.subtitle"
          value={review.subtitle}
          commit={(v) => change('subtitle', v)}
        />
        <!-- The refused entry STAYS in the field, under its reason: the person
           sees what was typed and what the format expects, and fixes it. -->
        <FieldText
          {language}
          label={te('editor.field.reviewDate', language)}
          draftKey="review.reviewDate"
          type="date"
          value={review.reviewDate}
          commit={(v) => change('reviewDate', v)}
          hint={te('editor.review.dateHint', language)}
          error={dateErrors.reviewDate}
        />
        <FieldText
          {language}
          label={te('editor.field.previousReviewDate', language)}
          draftKey="review.previousReviewDate"
          type="date"
          value={review.previousReviewDate}
          commit={(v) => change('previousReviewDate', v)}
          hint={te('editor.review.dateHint', language)}
          error={dateErrors.previousReviewDate}
        />
      </fieldset>
    </section>
  </div>

  <div class="flex min-w-0 flex-col gap-4">
    <section class="bg-background border-border rounded-lg border p-4">
      <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
        {te('editor.review.freeSlides', language)}
      </h2>
      <p class="text-muted-foreground mb-3 text-[11.5px]">
        {te('editor.review.freeSlidesHint', language)}
      </p>
      {#each slides as slide (slide.id)}
        <div class="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-1.5">
          <span class="flex flex-col gap-0.5 pt-2">
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground"
              title={te('editor.projects.moveUp', language)}
              aria-label="{te('editor.projects.moveUp', language)} {slide.title}"
              disabled={readOnly || neighbourOf(slide, -1) === undefined}
              onclick={() => moveSlide(slide, -1)}
              ><span class="inline-block -rotate-90">▸</span></Button
            >
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground"
              title={te('editor.projects.moveDown', language)}
              aria-label="{te('editor.projects.moveDown', language)} {slide.title}"
              disabled={readOnly || neighbourOf(slide, 1) === undefined}
              onclick={() => moveSlide(slide, 1)}
              ><span class="inline-block rotate-90">▸</span></Button
            >
          </span>
          <fieldset disabled={readOnly} class="contents">
            <FreeSlideCard {portfolio} {dispatch} {slide} />
          </fieldset>
        </div>
      {:else}
        <p class="text-muted-foreground text-[11.5px]">
          {te('editor.review.noFreeSlide', language)}
        </p>
      {/each}
      <Button
        variant="outline"
        size="sm"
        class="mt-2.5 w-full"
        disabled={readOnly}
        onclick={addSlide}
      >
        {te('editor.settings.add', language)}
      </Button>
    </section>
  </div>
</div>

{#if previewingTitle}
  <SlidePreviewDialog
    {portfolio}
    slide={{ type: 'title' }}
    subject={te('editor.preview.subject.title', language)}
    close={() => (previewingTitle = false)}
  />
{/if}
