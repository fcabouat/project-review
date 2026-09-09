<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import ExitBar from '../../src/slideshow/ExitBar.svelte'

  /* Only the BAR is on show here. `SlideshowHost` is never mounted in a story
: a story that booted reveal.js would load the engine, take
     over the page and leave its stylesheet behind in the Storybook shell. */
  const { Story } = defineMeta({
    title: 'Slideshow/ExitBar',
    component: ExitBar,
    parameters: {
      layout: 'fullscreen',
      backgrounds: { value: 'slide' },
      docs: {
        description: {
          component:
            'The slideshow exit bar: invisible over the slideshow, revealed by hovering the top 60 px of the stage or by focusing one of its buttons. `pinned` forces it open so the bar can be read here.',
        },
      },
    },
    args: {
      language: 'fr',
      back: () => {},
      overview: () => {},
      save: () => {},
      print: () => {},
      close: () => {},
    },
  })

  const noop = (): void => {}
</script>

<!-- Forced open: the bar as it looks once the pointer has reached the top edge. -->
<Story name="Displayed" args={{ pinned: true }} asChild>
  <div class="stage">
    <ExitBar
      language="fr"
      back={noop}
      overview={noop}
      save={noop}
      print={noop}
      close={noop}
      pinned
    />
    <p class="hint">Barre affichée (état « survol du bord haut »).</p>
  </div>
</Story>

<!-- Real behaviour: nothing shows until the pointer enters the top strip. -->
<Story name="On hover" asChild>
  <div class="stage">
    <ExitBar language="fr" back={noop} overview={noop} save={noop} print={noop} close={noop} />
    <p class="hint">Survoler les 60 px du haut pour faire apparaître la barre.</p>
  </div>
</Story>

<!-- English catalog: same three buttons, same widths to check. -->
<Story name="English" asChild>
  <div class="stage">
    <ExitBar
      language="en"
      back={noop}
      overview={noop}
      save={noop}
      print={noop}
      close={noop}
      pinned
    />
    <p class="hint">English labels.</p>
  </div>
</Story>

<style>
  /* stands in for the slideshow stage: dark ground, 16:9, position: relative */
  .stage {
    position: relative;
    aspect-ratio: 16 / 9;
    background: #1f2230;
    overflow: hidden;
  }
  .hint {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 24px;
    margin: 0;
    text-align: center;
    color: #ffffff8c;
    font-size: 13px;
    font-style: italic;
  }
</style>
