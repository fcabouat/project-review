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
            "Two halves. ABOVE, what the build offers: slide theme, reader scheme, language. BELOW, PORTFOLIO IDENTITY — the three assets the .json carries itself (palette, font, logo), in one section, with one licence line for the three: they raise the same question. No font is ever fetched from a third party, so the card names the three LOCAL sources and says which one applies. With a family the build does not carry («Atelier» here), the card states the files a deployment must serve under `fonts/<family>/` and shows the HOST-PROBED verdict (`fontStatus`): «served», «missing» and «probing» pin the three states. «Font embedded» shows the strongest source — the portfolio itself carries the woff2 faces (listed with family, weight and size; each removable) — and «Font bundled» the family that ships with the app. «Font refused» shows what a value outside the format's charset does: the entry stays in the field under the parse's own rule, and nothing is committed. «Portfolio palette» shows the twelve colours arriving through the DATA file: they head the list, they apply (the bundled families wait), and «Remove» is the whole editor there is — a palette is data, so it comes in with the data. The embed buttons and the logo import read files through the injected `readFontFile` and `readLogoFile` (here two tiny stubs) — the card opens no file itself; the scheme picker mock stamps the `dark` class exactly as the app does.",
        },
      },
    },
  })

  /** The sample portfolio, font switched to a family the build does not carry
   * — the case a deployment (or an embed) has to answer for. */
  const atelier = {
    ...sample,
    settings: {
      ...sample.settings,
      theme: { ...sample.settings.theme, font: 'Atelier' },
    },
  }

  /** Same portfolio with the faces EMBEDDED — the strongest source. */
  const embedded = {
    ...sample,
    settings: {
      ...sample.settings,
      theme: {
        ...sample.settings.theme,
        font: 'Atelier',
        fontFaces: [
          {
            family: 'Atelier',
            weight: '400',
            style: 'normal' as const,
            dataUri: `data:font/woff2;base64,${'d09GMgAB'.repeat(4_000)}`,
          },
          {
            family: 'Atelier',
            weight: '700 800',
            style: 'normal' as const,
            dataUri: `data:font/woff2;base64,${'d09GMgAB'.repeat(4_500)}`,
          },
        ],
      },
    },
  }

  /** Same portfolio carrying its OWN twelve colours — the palette arrives
   * through the data file, and then takes precedence over every family. */
  const housePalette = {
    ...sample,
    settings: {
      ...sample.settings,
      theme: {
        ...sample.settings.theme,
        customPalette: {
          label: 'Couleurs maison',
          colors: {
            blue: '#3460d8',
            indigo: '#7a4ecf',
            teal: '#017661',
            cyan: '#016770',
            green: '#027a1f',
            olive: '#666f02',
            amber: '#7e5e01',
            orange: '#a35301',
            red: '#c52b30',
            purple: '#a43cab',
            brown: '#7d4e2c',
            taupe: '#6b6456',
          },
        },
      },
    },
  }

  /** Story stub of the host's reader: accepts every pick as a tiny face. */
  const readFontFile = () => Promise.resolve('data:font/woff2;base64,d09GMgAB')
  /** The same seam for the mark: every pick lands as a plain coloured block. */
  const readLogoFile = () =>
    Promise.resolve(
      'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2240%22%3E%3Crect width=%22120%22 height=%2240%22 rx=%224%22 fill=%22%23312e81%22/%3E%3C/svg%3E',
    )
</script>

<script lang="ts">
  const store = createScreenStore(atelier)
  const embeddedStore = createScreenStore(embedded)
  const bundledStore = createScreenStore(sample)
  const refusedStore = createScreenStore(sample)
  const paletteStore = createScreenStore(housePalette)

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
      {readLogoFile}
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
      {readLogoFile}
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

<Story name="Font bundled" asChild>
  <div class="editor max-w-[520px] p-6">
    <AppearanceCard
      portfolio={bundledStore.present}
      dispatch={bundledStore.dispatch}
      {appearance}
      fontStatus="bundled"
    />
  </div>
</Story>

<!-- The refusal affordance: a family outside the format's charset is NOT
     committed, and the field says the parse's own rule instead of eating the
     entry. Type «Times New Roman!!» in the field to see it live. -->
<Story name="Font refused" asChild>
  <div class="editor max-w-[520px] p-6">
    <AppearanceCard
      portfolio={refusedStore.present}
      dispatch={refusedStore.dispatch}
      {appearance}
      fontStatus="bundled"
    />
  </div>
</Story>

<!-- The palette the FILE carries: first in the list, applied, and removable —
     removal is undoable, so the twelve colours are one Ctrl+Z away. -->
<Story name="Portfolio palette" asChild>
  <div class="editor max-w-[520px] p-6">
    <AppearanceCard
      portfolio={paletteStore.present}
      dispatch={paletteStore.dispatch}
      {appearance}
      fontStatus="bundled"
      {readFontFile}
      {readLogoFile}
    />
  </div>
</Story>
