<script lang="ts">
  /**
   * Cartouche — THE single component, identical on every slide, no
   * variant: 3 lines (directorate · service / review title / "Revue du …").
   * Only the color changes with the ground. The contact lives in the title
   * slide's bottom signature, not here. Anchoring (top-right of the frame,
   * 26/44 inset) belongs to the parent: the cartouche never positions itself.
   */
  import type { Identity, Review } from '@project-review/core/model/portfolio'
  import type { Language } from '@project-review/core/model/theme'
  import { formatLongDate, t } from '@project-review/core/services/i18n'
  import { identityLine } from './identity-line'

  interface Props {
    /** Organization block, read from the portfolio settings. */
    readonly identity: Identity
    readonly review: Review
    readonly language: Language
    /** Colored ground (title slide, divider): text in graded white. */
    readonly onColoredBackground?: boolean
  }

  let { identity, review, language, onColoredBackground = false }: Props = $props()

  const longDate = $derived(formatLongDate(review.reviewDate, language))
  /** Blank-identity grace: only the filled parts, no orphan « · », no ghost line. */
  const entity = $derived(identityLine(' · ', identity.org, identity.unit))
</script>

<div class="ent" class:on-colored-bg={onColoredBackground}>
  {#if entity}<b>{entity}</b>{/if}
  <i>{review.title}</i>
  <u>{t('title.reviewOf', language, { date: longDate })}</u>
</div>

<style>
  .ent {
    text-align: right;
    line-height: 1.35;
  }
  .ent b {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
  }
  .ent i {
    display: block;
    font-size: 12px;
    font-style: normal;
    color: var(--txt2);
  }
  .ent u {
    display: block;
    font-size: 11px;
    text-decoration: none;
    color: var(--muted);
  }
  .on-colored-bg b {
    color: #fff;
  }
  .on-colored-bg i {
    color: rgba(255, 255, 255, 0.85);
  }
  .on-colored-bg u {
    color: rgba(255, 255, 255, 0.7);
  }
</style>
