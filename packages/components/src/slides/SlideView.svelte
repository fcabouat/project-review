<script lang="ts">
  /**
   * Dispatcher: one `Slide` constructor → one template. The exhaustive `{#if}`
   * chain over `slide.type` is checked by the compiler through the discriminated
   * union — adding a constructor without its template would not type-check.
   * No layout of its own: the templates are the frames.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Slide } from '@project-review/core/projections/slide'
  import SlideTitle from './SlideTitle.svelte'
  import SlideFreeform from './SlideFreeform.svelte'
  import SlidePortfolioDashboard from './SlidePortfolioDashboard.svelte'
  import SlideHealthDashboard from './SlideHealthDashboard.svelte'
  import SlideRecap from './SlideRecap.svelte'
  import SlideDivider from './SlideDivider.svelte'
  import SlideSheet from './SlideSheet.svelte'
  import SlideDecisions from './SlideDecisions.svelte'
  import SlideArchives from './SlideArchives.svelte'
  import SlidePreviousDecisions from './SlidePreviousDecisions.svelte'

  interface Props {
    readonly portfolio: Portfolio
    readonly slide: Slide
    /** 1-based position in the deck and deck length, for the slide foot. */
    readonly page?: number
    readonly total?: number
    readonly logo?: string
  }

  let { portfolio, slide, page, total, logo }: Props = $props()
</script>

{#if slide.type === 'title'}
  <SlideTitle {portfolio} {logo} />
{:else if slide.type === 'freeform'}
  <SlideFreeform {portfolio} slideId={slide.slideId} {page} {total} {logo} />
{:else if slide.type === 'portfolioDashboard'}
  <SlidePortfolioDashboard {portfolio} {page} {total} {logo} />
{:else if slide.type === 'healthDashboard'}
  <SlideHealthDashboard {portfolio} {page} {total} {logo} />
{:else if slide.type === 'recap'}
  <SlideRecap
    {portfolio}
    projectIds={slide.projectIds}
    pageNumber={slide.page}
    totalPages={slide.totalPages}
    {page}
    {total}
    {logo}
  />
{:else if slide.type === 'divider'}
  <SlideDivider {portfolio} group={slide.group} number={slide.number} />
{:else if slide.type === 'sheet'}
  <SlideSheet {portfolio} projectId={slide.projectId} {page} {total} {logo} />
{:else if slide.type === 'decisions'}
  <SlideDecisions
    {portfolio}
    entries={slide.entries}
    pageNumber={slide.page}
    totalPages={slide.totalPages}
    {page}
    {total}
    {logo}
  />
{:else if slide.type === 'archives'}
  <SlideArchives
    {portfolio}
    projectIds={slide.projectIds}
    pageNumber={slide.page}
    totalPages={slide.totalPages}
    {page}
    {total}
    {logo}
  />
{:else if slide.type === 'previousDecisions'}
  <SlidePreviousDecisions
    {portfolio}
    entries={slide.entries}
    pageNumber={slide.page}
    totalPages={slide.totalPages}
    {page}
    {total}
    {logo}
  />
{/if}
