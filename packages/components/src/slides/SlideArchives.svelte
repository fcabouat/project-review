<script lang="ts">
  /**
   * Archives: closed and abandoned projects. They
   * leave the tracking but stay readable — hence the closing note, which is the
   * whole point of the slide.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { categoryOf, isArchived } from '@project-review/core/projections'
  import { catColor } from '../commons/cat-color'
  import { formatShortDate, t } from '@project-review/core/services/i18n'
  import StageChip from '../commons/StageChip.svelte'
  import TextLine from '../commons/TextLine.svelte'
  import SlideChrome from './SlideChrome.svelte'
  import { categoryName, columns, railText } from './labels'

  interface Props {
    readonly portfolio: Portfolio
    readonly page?: number
    readonly total?: number
    readonly logo?: string
  }

  let { portfolio, page, total, logo }: Props = $props()

  const language = $derived(portfolio.settings.language)

  /* The archives table has its own column-header catalog key — its wording
     is not shared with the recap table. */
  const headers = $derived(columns('archives.columns', language))

  /* Declaration order, not portfolio order: archives leave the categories
     behind — they are listed as they were entered (P-14, P-15, P-16). */
  const rows = $derived(
    portfolio.projects.filter(isArchived).map((project) => {
      const category = categoryOf(portfolio, project.categoryId)
      return {
        project,
        category,
        color: catColor(category.color),
        // Closing note: what the project last achieved — or, for an abandoned
        // one that achieved nothing, why it was dropped.
        note: project.done.at(-1) ?? project.risks,
      }
    }),
  )
</script>

<SlideChrome
  {portfolio}
  rail={railText(language, t('sidebar.archives', language))}
  {page}
  {total}
  {logo}
>
  {#snippet heading()}
    <h2 class="slide-heading">{t('archives.title', language)}</h2>
  {/snippet}

  <table class="table table--archives">
    <colgroup>
      <col style:width="62px" /><col style:width="260px" /><col style:width="214px" /><col
        style:width="130px"
      /><col style:width="110px" /><col />
    </colgroup>
    <thead>
      <tr>
        {#each headers as header, i (i)}
          <th>{header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.project.id)}
        <tr>
          <td class="num">{row.project.id}</td>
          <td class="name">{row.project.name}</td>
          <td style:--cat={row.color}
            ><span class="pill">{categoryName(row.category, language)}</span></td
          >
          <td><StageChip project={row.project} {language} /></td>
          <td class:dim={row.project.actualEnd === undefined}>
            {row.project.actualEnd
              ? formatShortDate(row.project.actualEnd)
              : t('priority.none', language)}
          </td>
          <!-- the closing note is entered in the micro-format -->
          <td>
            {#if row.note}<TextLine text={row.note} />{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="note">{t('archives.reminder', language)}</p>
</SlideChrome>
