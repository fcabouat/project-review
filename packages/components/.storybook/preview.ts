import type { Preview } from '@storybook/svelte-vite'

// The atoms carry no tokens of their own: they read the theme's (tokens.css),
// exactly as they do in the application.
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import './preview.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // The three grounds an atom must hold on: slide canvas, the recap table's
    // zebra row, a solid category plane.
    backgrounds: {
      options: {
        slide: { name: 'Slide canvas', value: '#FFFFFF' },
        zebra: { name: 'Zebra row', value: '#F6F6F6' },
        category: { name: 'Category plane', value: '#009099' },
      },
    },
  },
  // Toolbar switch between the three slide styles. The app keys its style CSS off
  // `data-slide-style` on <html> (see App.svelte / flat.css): the decorator
  // mirrors that attribute so every story can be read in both styles, without
  // touching the stories themselves.
  globalTypes: {
    style: {
      description: 'Slide style (data-slide-style)',
      toolbar: {
        title: 'Style',
        icon: 'paintbrush',
        items: [
          { value: 'flat', title: 'Flat' },
          { value: 'institutional', title: 'Institutional' },
          { value: 'modern', title: 'Modern' },
        ],
        dynamicTitle: true,
      },
    },
    // The editor's reader scheme: the app stamps a `dark` class on <html>
    // (tokens.css flips the chrome tokens; slides pin their light values).
    // The toolbar mirrors that, so EVERY story can be read in both schemes —
    // and the slide stories prove the artifact stays light under `dark`.
    scheme: {
      description: 'Editor scheme (`dark` class on <html>)',
      toolbar: {
        title: 'Scheme',
        icon: 'contrast',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    // The category colors are CSS custom properties scoped under data-palette
    // (palettes.css) — the app stamps the attribute on <html>, the toolbar
    // mirrors that so every story can be read under each family.
    palette: {
      description: 'Category palette (data-palette)',
      toolbar: {
        title: 'Palette',
        icon: 'circlehollow',
        items: [
          { value: 'material', title: 'Material' },
          { value: 'tailwind', title: 'Tailwind' },
          { value: 'uniform', title: 'Uniform' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (story, context) => {
      const style = context.globals['style']
      document.documentElement.dataset.slideStyle =
        style === 'institutional' || style === 'modern' ? style : 'flat'
      document.documentElement.dataset.palette =
        typeof context.globals['palette'] === 'string' ? context.globals['palette'] : 'material'
      document.documentElement.classList.toggle('dark', context.globals['scheme'] === 'dark')
      return story()
    },
  ],
  initialGlobals: {
    backgrounds: { value: 'slide' },
    style: 'flat',
    scheme: 'light',
    palette: 'material',
  },
}

export default preview
