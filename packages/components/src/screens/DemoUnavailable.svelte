<script lang="ts">
  import type { Language } from '@project-review/core/model/theme'
  import { te } from '../i18n'
  import { Button } from '../commons/ui/button'

  let { language, retry }: { readonly language: Language; readonly retry: () => void } = $props()
</script>

<main class="bg-background grid min-h-screen place-items-center p-6 text-center">
  <section class="max-w-md">
    <h1 class="text-primary text-xl font-bold">{te('editor.demo.unavailable', language)}</h1>
    <p class="text-muted-foreground mt-2 text-sm">{te('editor.demo.loadFailed', language)}</p>
    <Button class="mt-5" onclick={retry}>{te('editor.demo.retry', language)}</Button>
  </section>
</main>
