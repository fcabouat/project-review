<script lang="ts">
  /**
   * About — what this software is, and what it carries that it did not write.
   *
   * WHY IN THE PRODUCT. The deliverable is one redistributable HTML file:
   * whoever receives it by mail or on a USB stick holds the code and the fonts
   * with no repository to consult. Third-party notices belong where the
   * software is, so they travel with it — the repository's `THIRD-PARTY.md`
   * restates this very table (core's `data/third-party.ts` is the one source).
   *
   * Pure screen: the notices are data, the wording around them is the catalog,
   * and nothing here reaches for a store.
   */
  import type { Language } from '@project-review/core/model/theme'
  import {
    IMPORTED_CONTENT_NOTICE,
    THIRD_PARTY_NOTICES,
  } from '@project-review/core/data/third-party'
  import { te } from '../i18n'

  interface Props {
    readonly language: Language
  }

  let { language }: Props = $props()
</script>

<div class="mx-auto flex max-w-[760px] flex-col gap-4">
  <section class="bg-background border-border rounded-lg border p-4">
    <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
      {te('editor.about.product', language)}
    </h2>
    <p class="text-(--txt2) mb-1 text-[13.5px] leading-[1.55]">
      {te('editor.about.pitch', language)}
    </p>
    <p class="text-muted-foreground text-[12.5px] leading-[1.55]">
      {te('editor.about.built', language)} · {te('editor.about.author', language)} ·
      {te('editor.about.mail', language)}
    </p>
  </section>

  <section class="bg-background border-border rounded-lg border p-4">
    <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
      {te('editor.about.license', language)}
    </h2>
    <p class="text-(--txt2) mb-2 text-[13.5px] leading-[1.55]">
      {te('editor.about.licenseMit', language)}
    </p>
    <!-- The same sentence the README carries and the font-embedding form
         shows: MIT frees this software, never what a person imports into
         their own document. -->
    <p class="text-muted-foreground text-[12.5px] leading-[1.55]">{IMPORTED_CONTENT_NOTICE}</p>
  </section>

  <section class="bg-background border-border rounded-lg border p-4">
    <h2 class="text-primary mb-1 text-xs font-bold tracking-[0.06em] uppercase">
      {te('editor.about.thirdParty', language)}
    </h2>
    <p class="text-muted-foreground mb-3 text-[12.5px] leading-[1.55]">
      {te('editor.about.thirdPartyLead', language)}
    </p>
    <!-- English throughout, deliberately: a license name, a copyright line and
         a legal caveat are quoted material, not interface wording. -->
    <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
      {#each THIRD_PARTY_NOTICES as notice (notice.name)}
        <li class="border-border rounded-md border px-3.5 py-2.5">
          <p class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
            <span class="font-bold">{notice.name}</span>
            <span class="text-muted-foreground tabular-nums">{notice.version}</span>
            <span class="text-(--txt2) font-semibold">· {notice.license}</span>
          </p>
          <p class="text-(--txt2) mt-0.5 text-[12px] leading-[1.5]">{notice.copyright}</p>
          <p class="text-muted-foreground mt-0.5 text-[11.5px] leading-[1.5]">
            {notice.use} —
            <a class="underline" href={notice.url} target="_blank" rel="noreferrer noopener"
              >{notice.url}</a
            >
          </p>
          {#if notice.note}
            <p class="text-muted-foreground mt-1 text-[11.5px] leading-[1.5] italic">
              {notice.note}
            </p>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
</div>
