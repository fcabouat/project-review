<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Icon, { ICON_NAMES } from '../../src/commons/Icon.svelte'

  const { Story } = defineMeta({
    title: 'Atoms/Icon',
    component: Icon,
    parameters: {
      docs: {
        description: {
          component:
            'Inlined Remix Icon SVG (never the icon font). Size 1em by default: the icon follows the text; the color follows `currentColor`.',
        },
      },
    },
  })
</script>

<!-- Gallery: the 5 icons of the plan, at usage size (14 px) then at 1em inside a line of text. -->
<Story name="Gallery" asChild>
  <div class="gallery">
    {#each ICON_NAMES as name (name)}
      <div class="cell">
        <span class="disc"><Icon {name} size="14px" /></span>
        <code>{name}</code>
      </div>
    {/each}
  </div>
  <p class="line">
    Aligned on the text baseline <Icon name="arrow-right-line" /> without optical offset, whatever the
    size.
  </p>
</Story>

<style>
  .gallery {
    display: flex;
    gap: 27px;
    align-items: center;
    flex-wrap: wrap;
  }
  .cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .disc {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  code {
    font-size: 12px;
    color: var(--txt2);
  }
  .line {
    margin-top: 27px;
    font-size: 13px;
    color: var(--txt2);
  }
</style>
