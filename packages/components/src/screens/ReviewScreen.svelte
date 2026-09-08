<script lang="ts">
  /**
   * E0 — the review's own fields, plus the free slides anchored to it.
   *
   * The mockup shows this card as a read-only key/value list; here every line is
   * the editable field it stands for, since the editor is the only place these
   * values can be typed. One field ↔ one `ChangeReviewField` command, at blur —
   * `decide` reads the `before` and drops the no-ops.
   *
   * Pure screen: `portfolio` and `dispatch` in, nothing else — no store, no
   * router, no infrastructure (screens contract, `contracts.ts`).
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { ReviewField } from '@project-review/core/events'
  import { nextFreeSlideId } from '@project-review/core/values/ids'
  import type { FreeSlide } from '@project-review/core/model/free-slide'
  import { isoDate } from '@project-review/core/values/date'
  import { te } from '../i18n'
  import FieldText from '../editor/FieldText.svelte'
  import FreeSlideCard from '../editor/FreeSlideCard.svelte'
  import Icon from '../commons/Icon.svelte'
  import SlidePreviewDialog from '../editor/SlidePreviewDialog.svelte'
  import type { Dispatch } from './contracts'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
  }

  let { portfolio, dispatch }: Props = $props()

  const review = $derived(portfolio.review)
  const language = $derived(portfolio.settings.language)

  /**
   * A rejected review date leaves the store untouched, so the field's draft
   * would silently keep the invalid text: bumping this key remounts the field,
   * snapping the draft back to the stored value (the format hint stays shown).
   */
  let dateFieldEpoch = $state(0)

  /** One text field of the review — `reviewDate` is the only mandatory one (law 1). */
  function change(field: ReviewField, next: string | undefined): void {
    if (field === 'reviewDate' || field === 'previousReviewDate') {
      const when = next === undefined ? undefined : isoDate(next)
      // The review date is the reference of every derivation: it is never
      // cleared; both date fields refuse anything the brand refuses.
      if ((next !== undefined && when === undefined) || (field === 'reviewDate' && !when)) {
        dateFieldEpoch += 1
        return
      }
      dispatch({ type: 'ChangeReviewField', field, after: when } as never)
      return
    }
    dispatch({ type: 'ChangeReviewField', field, after: next } as never)
  }

  /** Mounted only while open: a closed preview renders no slide at all (E2ter). */
  let previewingTitle = $state(false)

  const openings = $derived(portfolio.freeSlides.filter((s) => s.anchor.type === 'opening'))

  function addOpening(): void {
    const slide: FreeSlide = {
      id: nextFreeSlideId(portfolio.freeSlides),
      anchor: { type: 'opening' },
      title: te('editor.settings.newSlide', language),
      blocks: [[]],
    }
    dispatch({ type: 'CreateFreeSlide', slide, index: portfolio.freeSlides.length })
  }

  /**
   * ↑/↓ move an opening slide RELATIVE TO ITS VISIBLE NEIGHBOUR: `to` is the
   * neighbour's index in the full `freeSlides` list, which `FreeSlideMoved`'s
   * splice semantics turn into "right before it" (up) / "right after it" (down).
   */
  function moveOpening(slide: FreeSlide, delta: -1 | 1): void {
    const neighbour = openings[openings.indexOf(slide) + delta]
    if (!neighbour) return
    dispatch({
      type: 'MoveFreeSlide',
      id: slide.id,
      to: portfolio.freeSlides.indexOf(neighbour),
    })
  }
</script>

<div class="settings-grid">
  <div class="settings-col">
    <section class="card">
      <h2 style="display:flex;align-items:center;justify-content:space-between">
        {te('editor.review.title', language)}
        <button
          class="icon-btn"
          type="button"
          title={te('editor.preview.titleSlide', language)}
          aria-label={te('editor.preview.titleSlide', language)}
          onclick={() => (previewingTitle = true)}><Icon name="eye-line" /></button
        >
      </h2>
      <FieldText
        {language}
        label={te('editor.field.title', language)}
        value={review.title}
        commit={(v) => change('title', v)}
        max={60}
      />
      <FieldText
        {language}
        label={te('editor.field.subtitle', language)}
        value={review.subtitle}
        commit={(v) => change('subtitle', v)}
        max={60}
      />
      {#key dateFieldEpoch}
        <FieldText
          {language}
          label={te('editor.field.reviewDate', language)}
          value={review.reviewDate}
          commit={(v) => change('reviewDate', v)}
          hint={te('editor.review.dateHint', language)}
        />
        <FieldText
          {language}
          label={te('editor.field.previousReviewDate', language)}
          value={review.previousReviewDate}
          commit={(v) => change('previousReviewDate', v)}
          hint={te('editor.review.dateHint', language)}
        />
      {/key}
    </section>
  </div>

  <div class="settings-col">
    <section class="card">
      <h2>{te('editor.review.freeSlides', language)}</h2>
      {#each openings as slide, index (slide.id)}
        <div class="freeslide-row">
          <span class="freeslide-move">
            <button
              class="icon-btn"
              type="button"
              title={te('editor.projects.moveUp', language)}
              aria-label="{te('editor.projects.moveUp', language)} {slide.title}"
              disabled={index === 0}
              onclick={() => moveOpening(slide, -1)}><span class="glyph-rot-up">▸</span></button
            >
            <button
              class="icon-btn"
              type="button"
              title={te('editor.projects.moveDown', language)}
              aria-label="{te('editor.projects.moveDown', language)} {slide.title}"
              disabled={index === openings.length - 1}
              onclick={() => moveOpening(slide, 1)}><span class="glyph-rot-down">▸</span></button
            >
          </span>
          <FreeSlideCard {portfolio} {dispatch} {slide} />
        </div>
      {:else}
        <p class="hint">{te('editor.review.noFreeSlide', language)}</p>
      {/each}
      <button
        class="btn btn-secondary btn-sm"
        type="button"
        style="width:100%;justify-content:center;margin-top:10px"
        onclick={addOpening}
      >
        {te('editor.settings.add', language)}
      </button>
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
