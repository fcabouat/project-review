<script lang="ts">
  /** One page of closed and abandoned projects, including their closing notes. */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import { categoryOf, projectById } from '@project-review/core/projections'
  import { catColor } from '../commons/cat-color'
  import { formatShortDate, t } from '@project-review/core/services/i18n'
  import StageChip from '../commons/StageChip.svelte'
  import TextLine from '../commons/TextLine.svelte'
  import SlideChrome from './SlideChrome.svelte'
  import { categoryName, columns, railText } from './labels'

  interface Props {
    readonly portfolio: Portfolio
    readonly projectIds: readonly string[]
    readonly pageNumber: number
    readonly totalPages: number
    readonly page?: number
    readonly total?: number
    readonly logo?: string
  }

  let { portfolio, projectIds, pageNumber, totalPages, page, total, logo }: Props = $props()

  const language = $derived(portfolio.settings.language)

  /* The archives table has its own column-header catalog key — its wording
     is not shared with the recap table. */
  const headers = $derived(columns('archives.columns', language))

  const rows = $derived(
    projectIds.flatMap((id) => {
      const project = projectById(portfolio, id)
      if (!project) return []
      const category = categoryOf(portfolio, project.categoryId)
      return [
        {
          project,
          category,
          color: catColor(category.color),
          // Closing note: what the project last achieved — or, for an abandoned
          // one that achieved nothing, why it was dropped.
          note: project.done.at(-1) ?? project.risks,
        },
      ]
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
    <div
      class="heading-row mt-(--slide-step) flex flex-none items-baseline justify-between gap-(--slide-gutter) print:mt-4 print:gap-6"
    >
      <h2
        class="slide-heading mt-0 text-[30px] leading-9 font-bold tracking-[-0.01em] print:text-[28.5px] print:leading-[34px]"
      >
        {t('archives.title', language)}
      </h2>
      {#if totalPages > 1}
        <span class="heading-note text-[12.5px] whitespace-nowrap print:text-[12px]">
          {t('recap.page', language, { page: pageNumber, total: totalPages })}
        </span>
      {/if}
    </div>
  {/snippet}

  {@const TH =
    'px-2.5 py-[9px] text-left text-xs leading-[1.45] font-bold tracking-[0.02em] print:px-[9px] print:text-[11.5px]'}
  {@const TD = 'px-2.5 py-1.5 align-middle print:px-[9px]'}
  <table class="table table--archives w-full table-fixed">
    <colgroup>
      <col style:width="62px" /><col style:width="260px" /><col style:width="214px" /><col
        style:width="130px"
      /><col style:width="110px" /><col />
    </colgroup>
    <thead>
      <tr>
        {#each headers as header, i (i)}
          <th class={TH}>{header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.project.id)}
        <tr class="h-13 print:h-14">
          <td class="num {TD} text-[12.5px] font-bold print:text-[12px]">{row.project.id}</td>
          <td class="name {TD} text-[13px] leading-[1.22] print:text-[12.5px]"
            >{row.project.name}</td
          >
          <td class="{TD} text-[13px] print:text-[12.5px]" style:--cat={row.color}
            ><span
              class="pill inline-flex h-[22px] items-center px-[9px] text-xs leading-[1.45] font-bold whitespace-nowrap print:h-[21px] print:px-2 print:text-[11.5px]"
              >{categoryName(row.category, language)}</span
            ></td
          >
          <td class="{TD} text-[13px] print:text-[12.5px]"
            ><StageChip project={row.project} {language} /></td
          >
          <td
            class="{TD} text-[13px] print:text-[12.5px]"
            class:dim={row.project.actualEnd === undefined}
          >
            {row.project.actualEnd
              ? formatShortDate(row.project.actualEnd)
              : t('priority.none', language)}
          </td>
          <!-- the closing note is entered in the micro-format -->
          <td class="{TD} text-[13px] print:text-[12.5px]">
            {#if row.note}<TextLine text={row.note} />{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="note mt-5 text-xs leading-[1.45] print:text-[11.5px]">
    {t('archives.reminder', language)}
  </p>
</SlideChrome>
