<script lang="ts">
  /**
   * Settings screen: appearance (palette, font, language), aggregate slides,
   * categories (CRUD + reorder) and free slides. Destructive confirmations
   * run in the vendored AlertDialog (see `settings/DataCard`).
   *
   * Every control emits a `ChangeSetting` / category command, so switching the
   * language or the palette is undoable like any other edit. `decide` reads the
   * `before` and drops the scalar no-ops — no guard needed here.
   *
   * Pure screen: `portfolio`, `dispatch` and the optional local-save switch in
   * — no store, no router, no infrastructure (screens contract, `contracts.ts`).
   *
   * Each card is its own component under `screens/settings/`; this screen only
   * lays them out on the two-column grid.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Dispatch, PersistenceControl } from './contracts'
  import IdentityCard from './settings/IdentityCard.svelte'
  import AppearanceCard from './settings/AppearanceCard.svelte'
  import AggregateSlidesCard from './settings/AggregateSlidesCard.svelte'
  import DataCard from './settings/DataCard.svelte'
  import CategoriesCard from './settings/CategoriesCard.svelte'
  import FreeSlidesCard from './settings/FreeSlidesCard.svelte'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    /** Local-save switch; absent → the row is not shown. */
    readonly persistence?: PersistenceControl
  }

  let { portfolio, dispatch, persistence }: Props = $props()
</script>

<div class="grid grid-cols-2 items-start gap-5">
  <div class="flex min-w-0 flex-col gap-4">
    <IdentityCard {portfolio} {dispatch} />
    <AppearanceCard {portfolio} {dispatch} />
    <AggregateSlidesCard {portfolio} {dispatch} />
    <DataCard {portfolio} {dispatch} {persistence} />
  </div>

  <div class="flex min-w-0 flex-col gap-4">
    <CategoriesCard {portfolio} {dispatch} />
    <FreeSlidesCard {portfolio} {dispatch} />
  </div>
</div>
