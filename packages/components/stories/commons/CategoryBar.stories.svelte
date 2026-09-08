<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import CategoryBar from '../../src/commons/CategoryBar.svelte'
  import { categoryColor, sample, language } from './story-data'
  import { categoryBars, categoryOf } from '@project-review/core/projections'
  import { t } from '@project-review/core/services/i18n'

  // The 8 non-empty categories of the sample data set, in portfolio order.
  const bars = categoryBars(sample)

  const { Story } = defineMeta({
    title: 'Atoms/CategoryBar',
    component: CategoryBar,
    parameters: {
      docs: {
        description: {
          component:
            'Segments in life-cycle order: pre-project (tint at 25 %), in progress (full tint), done (white outline). Shared scale — 1 project = 122.25 px — without which comparing two categories makes no sense any more.',
        },
      },
    },
  })
</script>

<Story name="Gallery" asChild>
  <div class="cats">
    {#each bars as b (b.categoryId)}
      <div class="cat-row" style:--cat={categoryColor(b.categoryId)}>
        <span class="cat-n">{categoryOf(sample, b.categoryId).name}</span>
        <span class="cat-c">{b.preProject + b.inProgress + b.done}</span>
        <CategoryBar bar={b} />
      </div>
    {/each}
  </div>
  <div class="legend">
    <i class="lg lg-en"></i>{t('d1.legend.inProgress', language)}
    <i class="lg lg-av"></i>{t('d1.legend.preProject', language)}
    <i class="lg lg-fi"></i>{t('d1.legend.done', language)}
  </div>
</Story>

<style>
  .cats {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cat-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .cat-n {
    width: 170px;
    flex: none;
    font-size: 13px;
    font-weight: 600;
    color: var(--txt);
  }
  .cat-c {
    width: 24px;
    flex: none;
    text-align: right;
    font-size: 13px;
    font-weight: 700;
    color: var(--txt2);
  }
  .legend {
    margin-top: 27px;
    display: flex;
    align-items: center;
    font-size: 11px;
    color: var(--muted);
  }
  .lg {
    display: inline-block;
    width: 13px;
    height: 9px;
    border-radius: 2px;
    margin: 0 5px 0 14px;
  }
  .legend .lg:first-child {
    margin-left: 0;
  }
  .lg-en {
    background: var(--txt2);
  }
  .lg-av {
    background: color-mix(in srgb, var(--txt2) 25%, #fff);
  }
  .lg-fi {
    background: #fff;
    border: 1.5px solid var(--txt2);
  }
</style>
