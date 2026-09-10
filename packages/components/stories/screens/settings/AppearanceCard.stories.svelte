<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  // The card is normally mounted by the settings screen inside the shell,
  // which owns the stylesheet import.
  import '../../../src/editor/editor.css'
  import AppearanceCard from '../../../src/screens/settings/AppearanceCard.svelte'
  import { sample } from '../../commons/story-data'
  import { createScreenStore } from '../screen-store.svelte'

  const { Story } = defineMeta({
    title: 'Screens/Settings/Appearance card',
    parameters: {
      layout: 'padded',
      docs: {
        description: {
          component:
            'Slide theme, reader scheme, palette, font — with the embedded-faces zone — and language. With the font set to «Marianne» — the one family served from the deployment — the card names the expected files and shows the HOST-PROBED verdict (`fontStatus`): three stories pin the probe states. «Font embedded» shows the fourth source: the portfolio itself carries the woff2 faces (listed with family, weight and size; each removable), the license line stays visible, and the status answers without probing. The embed buttons read files through the injected `readFontFile` (here a tiny stub); the scheme picker mock stamps the `dark` class exactly as the app does.',
        },
      },
    },
  })

  /** The sample portfolio, font switched to the locally served family. */
  const marianne = {
    ...sample,
    settings: {
      ...sample.settings,
      theme: { ...sample.settings.theme, font: 'Marianne' },
    },
  }

  /** Same portfolio with the faces EMBEDDED — the strongest source. */
  const embedded = {
    ...sample,
    settings: {
      ...sample.settings,
      theme: {
        ...sample.settings.theme,
        font: 'Marianne',
        fontFaces: [
          {
            family: 'Marianne',
            weight: '400',
            style: 'normal' as const,
            dataUri: `data:font/woff2;base64,${'d09GMgAB'.repeat(4_000)}`,
          },
          {
            family: 'Marianne',
            weight: '700 800',
            style: 'normal' as const,
            dataUri: `data:font/woff2;base64,${'d09GMgAB'.repeat(4_500)}`,
          },
        ],
      },
    },
  }

  /** Story stub of the host's reader: accepts every pick as a tiny face. */
  const readFontFile = () => Promise.resolve('data:font/woff2;base64,d09GMgAB')
</script>

<script lang="ts">
  const store = createScreenStore(marianne)
  const embeddedStore = createScreenStore(embedded)

  /** Story-local mock of the app's appearance control (see Shell stories). */
  let scheme = $state<'system' | 'light' | 'dark'>('light')
  const appearance = {
    get scheme() {
      return scheme
    },
    setScheme: (next: 'system' | 'light' | 'dark') => {
      scheme = next
      const dark =
        next === 'dark' ||
        (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
    },
  }
</script>

<Story name="Font served" asChild>
  <div class="editor max-w-[520px] p-6">
    <AppearanceCard
      portfolio={store.present}
      dispatch={store.dispatch}
      {appearance}
      fontStatus="served"
      {readFontFile}
    />
  </div>
</Story>

<Story name="Font embedded" asChild>
  <div class="editor max-w-[520px] p-6">
    <AppearanceCard
      portfolio={embeddedStore.present}
      dispatch={embeddedStore.dispatch}
      {appearance}
      fontStatus="embedded"
      {readFontFile}
    />
  </div>
</Story>

<Story name="Font missing" asChild>
  <div class="editor max-w-[520px] p-6">
    <AppearanceCard
      portfolio={store.present}
      dispatch={store.dispatch}
      {appearance}
      fontStatus="missing"
    />
  </div>
</Story>

<Story name="Font probing" asChild>
  <div class="editor max-w-[520px] p-6">
    <AppearanceCard
      portfolio={store.present}
      dispatch={store.dispatch}
      {appearance}
      fontStatus="unknown"
    />
  </div>
</Story>
