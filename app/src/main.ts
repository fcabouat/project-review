import { mount } from 'svelte'

// Bundled families (see infrastructure's fonts.ts): Roboto — the default —
// and Inter, self-hosted via @fontsource so neither ever hits Google Fonts —
// in the app or in its exports. Latin subset only, in the exact weights the
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

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
