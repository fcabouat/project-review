<script lang="ts">
  /**
   * EH — the event journal, in business wording (`eventLabel`). The journal
   * speaks EVENTS on purpose: views dispatch commands, but `past` records what
   * `decide` completed them into, and that is what can be undone.
   *
   * The list reads MOST RECENT FIRST, like the mockup: the undone events sit on
   * top, greyed and tagged, then the "current position" separator, then the
   * applied ones. Undo/redo move that separator — nothing is ever deleted from
   * the display until a new event branches the future away (the in-memory
   * history is capped at `HISTORY_LIMIT`; the oldest entries fall off the
   * bottom silently).
   *
   * The store carries no timestamp (events are pure): the time column of the
   * mockup would have to be invented here, so it is left out rather than faked.
   *
   * Pure screen: the trail comes in as plain props (`past`/`future`), the two
   * moves go out as callbacks — no store (screens contract, `contracts.ts`).
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { DomainEvent } from '@project-review/core/events'
  import { te } from '../i18n'
  import { eventLabel } from '../editor/event-label'

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
  const nameOf = $derived((kind: 'category' | 'freeSlide', id: string) =>
    kind === 'category'
      ? portfolio.categories.find((c) => c.id === id)?.name
      : portfolio.freeSlides.find((s) => s.id === id)?.title,
  )
  /** `future` is stored in redo order: reversed, it reads as "most recent first". */
  const undone = $derived([...future].reverse())
  const applied = $derived([...past].reverse())
  const total = $derived(past.length + future.length)
</script>

<section class="card hist-card">
  <div class="hist-head">
    <h2>{te('editor.history.title', language, { n: total })}</h2>
    <div class="hist-actions">
      <button
        class="btn btn-secondary btn-sm"
        type="button"
        disabled={past.length === 0}
        onclick={() => undo()}>↶ {te('editor.topbar.undo', language)}</button
      >
      <button
        class="btn btn-secondary btn-sm"
        type="button"
        disabled={future.length === 0}
        onclick={() => redo()}>↷ {te('editor.topbar.redo', language)}</button
      >
    </div>
  </div>

  {#if total === 0}
    <p class="hint">{te('editor.history.empty', language)}</p>
  {:else}
    <ul class="hist-list">
      {#each undone as event, i (`future-${i}`)}
        <li class="hist-row is-undone">
          <span class="hist-label">{eventLabel(event, language, nameOf)}</span>
          <span class="hist-tag">{te('editor.history.undone', language)}</span>
        </li>
      {/each}

      <li class="hist-sep">{te('editor.history.current', language)}</li>

      {#each applied as event, i (`past-${i}`)}
        <li class="hist-row">
          <span class="hist-label">{eventLabel(event, language, nameOf)}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="hist-foot">{te('editor.history.foot', language)}</p>
</section>
