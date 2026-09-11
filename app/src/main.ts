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
import { storedRevision } from '@project-review/core/services/persistence'
import { defaultStorage } from '@project-review/infrastructure/local-storage'
import App from './App.svelte'
import { detectLanguage, fetchSample, shouldBootSample } from './sample-boot'

// `?sample` — resolved BEFORE the app mounts (top-level await): the sample
// set is fetched from next door over http, silently skipped from file://,
// and an existing base always wins (policy in `sample-boot.ts`). The stored
// side is asked through `storedRevision`, which reads one number off the head
// of the bytes and is TOTAL over a storage that throws — the boot must not
// hinge on a `getItem` no one caught.
const storage = defaultStorage()
const sampleBoot = shouldBootSample(location.search, storage && storedRevision(storage))
  ? await fetchSample(detectLanguage(navigator.language))
  : undefined

const app = mount(App, {
  target: document.getElementById('app')!,
  props: { sampleBoot },
})

export default app
