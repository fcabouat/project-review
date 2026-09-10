<script lang="ts">
  /**
   * Appearance card: slide theme style, reader scheme, palette family, font —
   * with the embedded-faces zone — and interface language. Two controls here
   * do not dispatch commands themselves: the scheme picker (a reader
   * preference the host wires in, `AppearanceControl`) and the file READING
   * of the embed zone — FileReader is an effect, so the host injects
   * `readFontFile` and the card only maps names, checks caps and dispatches.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type {
    EmbeddedFontFace,
    Language,
    PaletteFamily,
    ThemeStyle,
  } from '@project-review/core/model/theme'
  import { LANGUAGES, PALETTES, THEME_STYLES } from '@project-review/core/model/theme'
  import type { Color } from '@project-review/core/model/category'
  import {
    FONT_FACE_MAX_CHARS,
    FONT_FACES_TOTAL_MAX_CHARS,
  } from '@project-review/core/services/parse'
  import { catColor } from '../../commons/cat-color'
  import { te } from '../../i18n'
  import { faceFromFileName, faceSizeKb } from '../../editor/font-files'
  import FieldText from '../../editor/FieldText.svelte'
  import FieldSegmented from '../../editor/FieldSegmented.svelte'
  import { Button } from '../../commons/ui/button'
  import * as RadioGroup from '../../commons/ui/radio-group'
  import type { AppearanceControl, ColorScheme, Dispatch, FontStatus } from '../contracts'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    /** Reader scheme picker; absent (a bare story) → the row is not shown. */
    readonly appearance?: AppearanceControl
    /** Live verdict on the theme font — the host probes, the card only
     * tells; absent, the card stays on the calm `unknown` wording. */
    readonly fontStatus?: FontStatus
    /** Reads one picked file into a woff2 data URI, or `null` for anything
     * unusable (infrastructure's FileReader); absent — a bare story — the
     * embed buttons stay inert. */
    readonly readFontFile?: (file: File) => Promise<string | null>
  }

  let { portfolio, dispatch, appearance, fontStatus, readFontFile }: Props = $props()

  const SCHEMES: readonly ColorScheme[] = ['system', 'light', 'dark']

  /** The one family served from the deployment rather than bundled/fetched:
   * only for it do the expected files and the live verdict appear. */
  const marianne = $derived(portfolio.settings.theme.font.trim() === 'Marianne')
  const probeState = $derived(fontStatus ?? 'unknown')

  const settings = $derived(portfolio.settings)
  const language = $derived(settings.language)
  const palette = $derived(settings.theme.palette)
  const fontFaces = $derived(settings.theme.fontFaces ?? [])

  function setStyle(after: ThemeStyle): void {
    dispatch({ type: 'ChangeSetting', setting: 'style', after })
  }

  function setLanguage(after: Language): void {
    dispatch({ type: 'ChangeSetting', setting: 'language', after })
  }

  function setPalette(after: PaletteFamily): void {
    dispatch({ type: 'ChangeSetting', setting: 'palette', after })
  }

  function setFont(raw: string | undefined): void {
    const after = raw === undefined || raw.trim() === '' ? 'Roboto' : raw.trim()
    dispatch({ type: 'ChangeSetting', setting: 'font', after })
  }

  /* ---- embedded faces (woff2 data URIs inside the portfolio) ---- */

  let filesInput = $state<HTMLInputElement | undefined>()
  let folderInput = $state<HTMLInputElement | undefined>()
  /** Refusal lines of the LAST pick — cleared on the next one. */
  let embedErrors = $state<readonly string[]>([])

  /** Same variant = same slot: re-embedding a file replaces its face. */
  const slotOf = (f: EmbeddedFontFace): string => `${f.family}/${f.weight}/${f.style}`

  /**
   * One pick → at most ONE `ChangeSetting`: every readable file under the
   * caps joins the collection in a single undoable action; every refused
   * file gets its own calm line. The caps mirror the parse exactly — what
   * this card lets in, the strict import lets back in.
   */
  async function embed(files: FileList | null): Promise<void> {
    embedErrors = []
    if (!readFontFile || files === null || files.length === 0) return
    const picked = [...files]
    const woff2 = picked.filter((file) => faceFromFileName(file.name) !== undefined)
    const refused: string[] = []
    if (woff2.length === 0) {
      embedErrors = [te('editor.settings.noWoff2', language)]
      return
    }

    // Plain local accumulator (not reactive state): same-slot faces replace.
    const faces: EmbeddedFontFace[] = [...fontFaces]
    const put = (face: EmbeddedFontFace): void => {
      const i = faces.findIndex((f) => slotOf(f) === slotOf(face))
      if (i >= 0) faces[i] = face
      else faces.push(face)
    }
    for (const file of woff2) {
      const proposal = faceFromFileName(file.name)!
      const dataUri = await readFontFile(file)
      if (dataUri === null) {
        refused.push(te('editor.settings.fontFaceUnreadable', language, { name: file.name }))
        continue
      }
      if (dataUri.length > FONT_FACE_MAX_CHARS) {
        refused.push(
          te('editor.settings.fontFaceTooBig', language, {
            name: file.name,
            max: Math.round((FONT_FACE_MAX_CHARS * 3) / 4 / 1024),
          }),
        )
        continue
      }
      put({ ...proposal, dataUri })
    }
    const total = faces.reduce((sum, f) => sum + f.dataUri.length, 0)
    if (total > FONT_FACES_TOTAL_MAX_CHARS) {
      refused.push(
        te('editor.settings.fontsTotalTooBig', language, {
          max: Math.round((FONT_FACES_TOTAL_MAX_CHARS * 3) / 4 / 1024),
        }),
      )
      embedErrors = refused
      return
    }
    embedErrors = refused
    if (faces.length !== fontFaces.length || faces.some((f, i) => f !== fontFaces[i])) {
      dispatch({ type: 'ChangeSetting', setting: 'fontFaces', after: faces })
    }
  }

  /** Removes one face; the LAST removal erases the key (`undefined`). */
  function removeFace(face: EmbeddedFontFace): void {
    embedErrors = []
    const rest = fontFaces.filter((f) => f !== face)
    dispatch({
      type: 'ChangeSetting',
      setting: 'fontFaces',
      after: rest.length === 0 ? undefined : rest,
    })
  }

  /** The four dots of a palette preview — a sample, not the whole family. */
  const PREVIEW: readonly Color[] = ['blue', 'teal', 'green', 'red']
</script>

<section class="bg-background border-border rounded-lg border p-4">
  <h2 class="text-primary mb-3 text-xs font-bold tracking-[0.06em] uppercase">
    {te('editor.settings.appearance', language)}
  </h2>

  <FieldSegmented
    label={te('editor.setting.style', language)}
    value={settings.theme.style}
    options={THEME_STYLES.map((candidate) => ({
      value: candidate,
      label: te(`editor.style.${candidate}`, language),
    }))}
    commit={setStyle}
  />

  {#if appearance}
    <FieldSegmented
      label={te('editor.setting.scheme', language)}
      value={appearance.scheme}
      options={SCHEMES.map((candidate) => ({
        value: candidate,
        label: te(`editor.scheme.${candidate}`, language),
      }))}
      hint={te('editor.settings.schemeHint', language)}
      commit={(next) => appearance?.setScheme(next)}
    />
  {/if}

  <div class="mb-4 flex flex-col gap-[7px]">
    <span class="text-(--txt2) text-[12.5px] font-semibold"
      >{te('editor.setting.palette', language)}</span
    >
    <RadioGroup.Root
      class="flex flex-col gap-[7px]"
      value={palette}
      onValueChange={(v) => setPalette(v as PaletteFamily)}
      aria-label={te('editor.setting.palette', language)}
    >
      {#each PALETTES as family (family)}
        {@const checked = palette === family}
        <label
          class="{checked
            ? 'border-primary bg-accent'
            : 'border-input bg-background'} has-[:focus-visible]:outline-ring relative flex cursor-pointer items-center gap-[9px] rounded-[7px] border px-2.5 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1"
        >
          <RadioGroup.Item value={family} class="sr-only" />
          <!-- The dots preview THIS family, not the active one: the local
               data-palette re-scopes the --cat-* variables (palettes.css). -->
          <span class="flex flex-none gap-1" data-palette={family} aria-hidden="true">
            {#each PREVIEW as color (color)}
              <span
                class="inline-block size-3 rounded-full shadow-[0_0_0_1px_rgb(0_0_0/0.08)]"
                style="background:{catColor(color)}"
              ></span>
            {/each}
          </span>
          <span class="{checked ? 'text-primary font-bold' : 'text-(--txt2)'} text-[12.5px]"
            >{te(`editor.palette.${family}`, language)}</span
          >
        </label>
      {/each}
    </RadioGroup.Root>
  </div>

  <div class="mb-4 flex flex-col gap-[7px]">
    <span class="text-(--txt2) text-[12.5px] font-semibold"
      >{te('editor.setting.font', language)}</span
    >
    <!-- Free text: "Marianne" (served if the woff2 files are deployed
         alongside; never fetched), or any Google Fonts family, loaded on
         demand. -->
    <FieldText
      {language}
      value={settings.theme.font}
      ariaLabel={te('editor.setting.font', language)}
      hint={te('editor.settings.fontHint', language)}
      commit={setFont}
    />
    {#if probeState === 'embedded'}
      <!-- Third source, and the strongest: the portfolio itself carries the
           faces — no deployment, no network, the export inherits them. -->
      <span class="text-[11.5px] font-semibold" aria-live="polite">
        <span class="text-(--ok)">{te('editor.settings.fontProbe.embedded', language)}</span>
      </span>
    {:else if marianne}
      <!-- Marianne is served from the deployment: name the exact files, then
           TELL THE TRUTH — the host's document.fonts probe says whether the
           faces are actually there. aria-live announces the settled verdict
           without stealing focus. -->
      <span class="text-muted-foreground text-[11.5px]">
        {te('editor.settings.marianneFiles', language)}
      </span>
      <span class="text-[11.5px] font-semibold" aria-live="polite">
        {#if probeState === 'served'}
          <span class="text-(--ok)">{te('editor.settings.fontProbe.served', language)}</span>
        {:else if probeState === 'missing'}
          <span class="text-(--vig-txt)">{te('editor.settings.fontProbe.missing', language)}</span>
        {:else}
          <span class="text-muted-foreground"
            >{te('editor.settings.fontProbe.unknown', language)}</span
          >
        {/if}
      </span>
    {/if}
  </div>

  <!-- Embedded font: the theme font travels INSIDE the .json — picked as
       .woff2 files (or a whole folder), mapped by file name, capped exactly
       like the parse. Reading the files is the host's injected effect. -->
  <div class="mb-4 flex flex-col gap-[7px]">
    <span class="text-(--txt2) text-[12.5px] font-semibold"
      >{te('editor.settings.embeddedFonts', language)}</span
    >
    {#if fontFaces.length > 0}
      <ul class="flex flex-col gap-1">
        {#each fontFaces as face (slotOf(face))}
          <li
            class="border-border bg-secondary/60 flex items-center gap-2 rounded-md border py-1 pr-1 pl-2.5 text-[12px]"
          >
            <span class="font-semibold">{face.family}</span>
            <span class="text-muted-foreground">
              {face.weight}{face.style === 'italic'
                ? ` ${te('editor.settings.faceItalic', language)}`
                : ''}
              · {te('editor.settings.faceSize', language, { n: faceSizeKb(face.dataUri) })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              class="text-muted-foreground ml-auto h-7"
              aria-label={te('editor.settings.removeFaceAria', language, {
                family: face.family,
                weight: face.weight,
              })}
              onclick={() => removeFace(face)}
            >
              {te('editor.settings.removeFace', language)}
            </Button>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={readFontFile === undefined}
        onclick={() => filesInput?.click()}
      >
        {te('editor.settings.embedFiles', language)}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={readFontFile === undefined}
        onclick={() => folderInput?.click()}
      >
        {te('editor.settings.embedFolder', language)}
      </Button>
    </div>
    <input
      bind:this={filesInput}
      type="file"
      accept=".woff2,font/woff2"
      multiple
      class="hidden"
      onchange={(e) => {
        void embed(e.currentTarget.files)
        e.currentTarget.value = ''
      }}
    />
    <!-- The folder picker is the NATIVE `webkitdirectory` input — no File
         System Access API (absent from file:// and not portable). -->
    <input
      bind:this={folderInput}
      type="file"
      webkitdirectory
      class="hidden"
      onchange={(e) => {
        void embed(e.currentTarget.files)
        e.currentTarget.value = ''
      }}
    />
    {#each embedErrors as line (line)}
      <p class="text-destructive text-[11.5px]" role="alert">{line}</p>
    {/each}
    <p class="text-muted-foreground text-[11.5px]">
      {te('editor.settings.embedHint', language)}
    </p>
    <p class="text-muted-foreground text-[11.5px]">
      {te('editor.settings.embedLicense', language)}
    </p>
  </div>

  <FieldSegmented
    label={te('editor.setting.language', language)}
    value={language}
    options={LANGUAGES.map((candidate) => ({
      value: candidate,
      label: candidate.toUpperCase(),
    }))}
    ariaLabel={te('editor.setting.language', language)}
    commit={setLanguage}
  />
</section>
