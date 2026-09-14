import { mount } from 'svelte'

// Bundled families (see infrastructure's fonts.ts): Roboto — the default —
// and Inter, self-hosted via @fontsource so neither ever reaches for a third
// party — in the app or in its exports. Latin subset only, in the exact weights the
// slides and the editor use (400/500/600/700/800 — grep `font-weight` first).
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-600.css'
import '@fontsource/roboto/latin-700.css'
import '@fontsource/roboto/latin-800.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'

import './app.css'
import App from './App.svelte'
import { detectLanguage, fetchSample, type DemoBoot } from './sample-boot'

const demoRequested = new URLSearchParams(location.search).has('sample')
// Demo boot is deliberately isolated: it never asks localStorage for either a
// portfolio or a reader preference. Both fictional language variants are
// loaded up front so changing language swaps the complete artifact.
let sampleBoot: DemoBoot | undefined
if (demoRequested) {
  const language = detectLanguage(navigator.language, location.search)
  const [primary, alternate] = await Promise.all([
    fetchSample(language),
    fetchSample(language === 'fr' ? 'en' : 'fr'),
  ])
  sampleBoot =
    primary && alternate
      ? { portfolios: { [language]: primary, [language === 'fr' ? 'en' : 'fr']: alternate } }
      : { portfolios: {}, error: 'demo-load-failed' }
}

const app = mount(App, {
  target: document.getElementById('app')!,
  props: { sampleBoot },
})

export default app
