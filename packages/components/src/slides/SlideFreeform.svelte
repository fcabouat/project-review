<script lang="ts">
  /**
   * Free slide: the entered title, then 1 to 3
   * blocks of bullets in the micro-format, read at arm's length (17 px), the
   * whole vertically centered in the body.
   * Nothing here is derived: the content is exactly what was typed.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { t } from '@project-review/core/services/i18n'
  import { categoryOf } from '@project-review/core/projections'
  import TextLine from '../commons/TextLine.svelte'
  import SlideChrome from './SlideChrome.svelte'
  import { displayLabel } from '../commons/display'
  import { categoryName, railText } from './labels'

  interface Props {
    readonly portfolio: Portfolio
    readonly slideId: string
    readonly page?: number
    readonly total?: number
    readonly logo?: string
  }

  let { portfolio, slideId, page, total, logo }: Props = $props()

  const language = $derived(portfolio.settings.language)
  const slide = $derived(portfolio.freeSlides.find((s) => s.id === slideId))

  /** The rail names the section the slide opens: its anchor. */
  const section = $derived.by(() => {
    const anchor = slide?.anchor
    if (anchor === undefined) return undefined
    if (anchor.type === 'opening') return t('sidebar.opening', language)
    if (anchor.type === 'beforeCategory')
      return categoryName(categoryOf(portfolio, anchor.categoryId), language)
    return undefined
  })
</script>

<SlideChrome
  {portfolio}
  rail={railText(language, section)}
  {page}
  {total}
  {logo}
  bodyClass="slide-body--centered"
>
  {#snippet heading()}
    <h2 class="slide-heading">{displayLabel(slide?.title)}</h2>
  {/snippet}
  <div class="freeform-blocks">
    {#each slide?.blocks ?? [] as block, i (i)}
      <div class="card freeform-card">
        <ul class="bullets">
          {#each block as line, j (j)}
            <TextLine text={line} bullet />
          {/each}
        </ul>
      </div>
    {/each}
  </div>
</SlideChrome>
