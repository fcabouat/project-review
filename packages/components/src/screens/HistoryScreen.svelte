<script lang="ts">
  /**
   * History screen — the event journal, in business wording (`eventLabel`). The journal
   * speaks EVENTS on purpose: views dispatch commands, but `past` records what
   * `decide` completed them into, and that is what can be undone.
   *
   * The list reads MOST RECENT FIRST: the undone events sit on
   * top, greyed and tagged, then the "current position" separator, then the
   * applied ones. Undo/redo move that separator — nothing is ever deleted from
   * the display until a new event branches the future away (the in-memory
   * history is capped at `HISTORY_LIMIT`; the oldest entries fall off the
   * bottom silently).
   *
   * The store carries no timestamp (events are pure): the time column of the
   * layout would have to be invented here, so it is left out rather than faked.
   *
   * Pure screen: the trail comes in as plain props (`past`/`future`), the two
   * moves go out as callbacks — no store (screens contract, `contracts.ts`).
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { DomainEvent } from '@project-review/core/events'
  import { te } from '../i18n'
  import { eventLabel } from '../editor/event-label'
  import { Button } from '../commons/ui/button'

  interface Props {
    readonly portfolio: Portfolio
    /** Applied events, oldest first — the store's `past`, verbatim. */
    readonly past: readonly DomainEvent[]
    /** Undone events, in redo order — the store's `future`, verbatim. */
    readonly future: readonly DomainEvent[]
    readonly undo: () => void
    readonly redo: () => void
  }

  let { portfolio, past, future, undo, redo }: Props = $props()

  const language = $derived(portfolio.settings.language)
  /** Current names for the aggregates an event only knows by id. */
  const nameOf = $derived((kind: 'category' | 'freeSlide' | 'project', id: string) =>
    kind === 'project'
      ? portfolio.projects.find((p) => p.id === id)?.name
      : kind === 'category'
        ? portfolio.categories.find((c) => c.id === id)?.name
        : portfolio.freeSlides.find((s) => s.id === id)?.title,
  )
  /** `future` is stored in redo order: reversed, it reads as "most recent first". */
  const undone = $derived([...future].reverse())
  const applied = $derived([...past].reverse())
  const total = $derived(past.length + future.length)
</script>

<section class="bg-background border-border max-w-[760px] rounded-lg border p-4">
  <div class="border-border mb-3.5 flex items-center justify-between border-b pb-[11px]">
    <h2 class="text-primary text-xs font-bold tracking-[0.06em] uppercase">
      {te('editor.history.title', language, { n: total })}
    </h2>
    <div class="flex gap-2">
      <Button variant="outline" size="sm" disabled={past.length === 0} onclick={() => undo()}
        >↶ {te('editor.topbar.undo', language)}</Button
      >
      <Button variant="outline" size="sm" disabled={future.length === 0} onclick={() => redo()}
        >↷ {te('editor.topbar.redo', language)}</Button
      >
    </div>
  </div>

  {#if total === 0}
    <p class="text-muted-foreground text-[11.5px]">{te('editor.history.empty', language)}</p>
  {:else}
    <ul class="m-0 list-none p-0">
      {#each undone as event, i (`future-${i}`)}
        <li
          class="border-border text-muted-foreground flex items-baseline gap-3 border-b px-0.5 py-2 text-[13px]"
        >
          <span class="min-w-0 flex-1">{eventLabel(event, language, nameOf)}</span>
          <span class="flex-none text-[11px] italic">{te('editor.history.undone', language)}</span>
        </li>
      {/each}

      <li
        class="text-muted-foreground py-[9px] text-center text-[11px] font-semibold tracking-[0.03em]"
      >
        {te('editor.history.current', language)}
      </li>

      {#each applied as event, i (`past-${i}`)}
        <li
          class="border-border text-foreground flex items-baseline gap-3 border-b px-0.5 py-2 text-[13px] last:border-b-0"
        >
          <span class="min-w-0 flex-1">{eventLabel(event, language, nameOf)}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="text-muted-foreground mt-3.5 text-[11.5px]">{te('editor.history.foot', language)}</p>
</section>
