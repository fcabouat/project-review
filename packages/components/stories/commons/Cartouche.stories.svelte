<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Cartouche from '../../src/commons/Cartouche.svelte'
  import { categoryColor, sample, language } from './story-data'

  const { Story } = defineMeta({
    title: 'Atoms/Cartouche',
    component: Cartouche,
    args: { identity: sample.settings.identity, review: sample.review, language },
    parameters: {
      docs: {
        description: {
          component:
            'THE single component (§ 3.1): three lines everywhere, no variant — the contact lives in the title slide signature. Only the color changes with the ground. Anchoring (top-right, 26 / 44 inset) belongs to the parent.',
        },
      },
    },
  })
</script>

<!-- Light ground: every white-canvas slide. -->
<Story name="On a light ground" asChild>
  <div class="ground light">
    <Cartouche identity={sample.settings.identity} review={sample.review} {language} />
  </div>
</Story>

<!-- Colored ground: title slide and dividers. -->
<Story name="On a colored ground" asChild>
  <div class="ground" style:background={categoryColor('infra')}>
    <Cartouche
      identity={sample.settings.identity}
      review={sample.review}
      {language}
      onColoredBackground
    />
  </div>
</Story>

<style>
  .ground {
    display: flex;
    justify-content: flex-end;
    padding: 26px 44px;
    width: 520px;
  }
  .light {
    background: var(--bg);
    border: 1px solid var(--border2);
  }
</style>
