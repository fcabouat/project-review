import type { Preview } from '@storybook/svelte-vite'

// Les atomes n'embarquent aucun token : ils lisent ceux du thème (tokens.css),
// exactement comme dans l'application.
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
    // Les trois fonds sur lesquels un atome doit tenir : canevas de slide, ligne
    // zébrée du récapitulatif, aplat de catégorie (piège n° 13).
    backgrounds: {
      options: {
        slide: { name: 'Canevas de slide', value: '#FFFFFF' },
        zebrure: { name: 'Ligne zébrée', value: '#F6F6F6' },
        categorie: { name: 'Aplat de catégorie', value: '#009099' },
      },
    },
  },
  // Toolbar switch between the two slide styles. The app keys its style CSS off
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
          { value: 'classique', title: 'Classique' },
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
          { value: 'dsfr', title: 'DSFR' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (story, context) => {
      document.documentElement.dataset.slideStyle =
        context.globals['style'] === 'classique' ? 'classique' : 'flat'
      document.documentElement.dataset.palette =
        typeof context.globals['palette'] === 'string' ? context.globals['palette'] : 'material'
      return story()
    },
  ],
  initialGlobals: {
    backgrounds: { value: 'slide' },
    style: 'flat',
    palette: 'material',
  },
}

export default preview
