<script lang="ts">
  /**
   * Appearance card, in two halves.
   *
   * ABOVE — what THIS BUILD offers: the slide theme, the reader scheme and the
   * interface language.
   *
   * BELOW — PORTFOLIO IDENTITY: the three assets the .json file carries
   * itself, gathered in one section because they are one idea. An
   * organization's colours, typeface and mark travel INSIDE the document —
   * no deployment, no network, nothing to install on the machine that opens
   * it — and they arrived at three different moments, which is the only
   * reason they used to sit apart. The three rows say the same four things in
   * the same order: what the file carries, its summary, how to replace it,
   * how to take it away. One licence line closes the section, for the three
   * together: they raise exactly one question, and it is the same one.
   *
   * Two controls here do not dispatch commands themselves: the scheme picker
   * (a reader preference the host wires in, `AppearanceControl`) and the file
   * READING of the two rows that take one — FileReader is an effect, so the
   * host injects `readFontFile` and `readLogoFile`, and the card only maps
   * names, checks caps and dispatches.
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
  import { COLORS } from '@project-review/core/model/category'
  import {
    FONT_FACE_MAX_CHARS,
    FONT_FACES_TOTAL_MAX_CHARS,
    LOGO_MAX_CHARS,
  } from '@project-review/core/services/parse'
  import { isFontFamily } from '@project-review/core/values/font'
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
    /** Same seam for the mark: one picked file into an image data URI, `null`
     * for anything unusable; absent, the import button stays inert. */
    readonly readLogoFile?: (file: File) => Promise<string | null>
  }

  let { portfolio, dispatch, appearance, fontStatus, readFontFile, readLogoFile }: Props = $props()

  const SCHEMES: readonly ColorScheme[] = ['system', 'light', 'dark']

  const probeState = $derived(fontStatus ?? 'unknown')
  const family = $derived(portfolio.settings.theme.font.trim())
  /** The deployment convention only concerns a family this build does not
   * carry and the portfolio does not embed — exactly the probed cases. */
  const deployable = $derived(
    probeState === 'served' || probeState === 'missing' || probeState === 'unknown',
  )

  const settings = $derived(portfolio.settings)
  const language = $derived(settings.language)
  const identity = $derived(settings.identity)
  const palette = $derived(settings.theme.palette)
  const fontFaces = $derived(settings.theme.fontFaces ?? [])
  /** The palette the FILE carries, when it carries one — it takes precedence
   * over the chosen family for as long as it is there. */
  const customPalette = $derived(settings.theme.customPalette)

  function setStyle(after: ThemeStyle): void {
    dispatch({ type: 'ChangeSetting', setting: 'style', after })
  }

  function setLanguage(after: Language): void {
    dispatch({ type: 'ChangeSetting', setting: 'language', after })
  }

  function setPalette(after: PaletteFamily): void {
    dispatch({ type: 'ChangeSetting', setting: 'palette', after })
  }

  /** Drops the portfolio's own palette — undoable like every other edit, so
   * the twelve colours are one Ctrl+Z away from coming back. */
  function removeCustomPalette(): void {
    dispatch({ type: 'ChangeSetting', setting: 'customPalette', after: undefined })
  }

  /** Refusal line of the last font entry — cleared by the next accepted one. */
  let fontError = $state<string | undefined>(undefined)

  /**
   * The font field is where the memory/file contract is most visible: the name
   * lands verbatim in the exported deck's stylesheet, so the format pins its
   * charset — and `decide` refuses anything outside it. Checking the SAME rule
   * here (`isFontFamily`, the core's own predicate) is what turns a silent
   * refusal into a sentence: the wording shown is the parse's own
   * `invalidFont`, never a softer story invented for the form.
   */
  function setFont(raw: string | undefined): void {
    const after = raw === undefined || raw.trim() === '' ? 'Roboto' : raw.trim()
    if (!isFontFamily(after)) {
      fontError = te('editor.error.invalidFont', language, { value: after.slice(0, 64) })
      return
    }
    fontError = undefined
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

  /* ---- inline logo: a data URI in the JSON, or nothing at all ---------- */

  let logoInput = $state<HTMLInputElement | undefined>()
  let logoError = $state<string | undefined>(undefined)

  /** One pick → one refusal line or one undoable action, exactly like the
   * faces above: the host reads the file, the card checks the cap it words. */
  async function importLogo(files: FileList | null): Promise<void> {
    logoError = undefined
    const file = files?.[0]
    if (!readLogoFile || !file) return
    const uri = await readLogoFile(file)
    if (uri === null) {
      logoError = te('editor.settings.logoUnreadable', language)
      return
    }
    if (uri.length > LOGO_MAX_CHARS) {
      logoError = te('editor.settings.logoTooBig', language)
      return
    }
    dispatch({ type: 'ChangeIdentityField', field: 'logo', after: uri })
  }

  function resetLogo(): void {
    logoError = undefined
    dispatch({ type: 'ChangeIdentityField', field: 'logo', after: undefined })
  }

  /** The four dots of a palette preview — a sample, not the whole family. */
  const PREVIEW: readonly Color[] = ['blue', 'teal', 'green', 'red']

  const ROW_CLASS =
    'has-[:focus-visible]:outline-ring relative flex items-center gap-[9px] rounded-[7px] border px-2.5 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1'
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

  <!-- ============ the three assets the FILE carries, in one section ======= -->
  <h3
    class="text-(--txt2) border-border mt-5 mb-1.5 border-t pt-4 text-xs font-bold tracking-[0.06em] uppercase"
  >
    {te('editor.settings.portfolioIdentity', language)}
  </h3>
  <p class="text-muted-foreground mb-3.5 text-[11.5px]">
    {te('editor.settings.identityHint', language)}
  </p>

  <!-- 1. Colours: the built-in families, plus the portfolio's own palette
       when it carries one — which then applies, whatever family is named. -->
  <div class="mb-4 flex flex-col gap-[7px]">
    <span class="text-(--txt2) text-[12.5px] font-semibold"
      >{te('editor.setting.palette', language)}</span
    >
    <RadioGroup.Root
      class="flex flex-col gap-[7px]"
      value={customPalette ? 'portfolio' : palette}
      onValueChange={(v) => v !== 'portfolio' && setPalette(v as PaletteFamily)}
      aria-label={te('editor.setting.palette', language)}
    >
      {#if customPalette}
        <div class="{ROW_CLASS} border-primary bg-accent">
          <!-- The label names the radio; the removal button stays OUTSIDE it,
               so taking the palette away is never a click on the choice. -->
          <label class="flex min-w-0 flex-1 items-center gap-[9px]">
            <RadioGroup.Item value="portfolio" class="sr-only" />
            <!-- The file's own hexes, not a var(): this palette is in no
                 [data-palette] block — it IS the data. -->
            <span class="flex flex-none gap-1" aria-hidden="true">
              {#each PREVIEW as color (color)}
                <span
                  class="inline-block size-3 rounded-full shadow-[0_0_0_1px_rgb(0_0_0/0.08)]"
                  style="background:{customPalette.colors[color]}"
                ></span>
              {/each}
            </span>
            <span class="text-primary min-w-0 flex-1 truncate text-[12.5px] font-bold">
              {customPalette.label ?? te('editor.palette.portfolio', language)}
              <span class="text-muted-foreground font-normal"
                >· {te('editor.settings.paletteCount', language, { n: COLORS.length })}</span
              >
            </span>
          </label>
          <Button
            variant="ghost"
            size="sm"
            class="text-muted-foreground -mr-1.5 h-7 flex-none"
            aria-label={te('editor.settings.paletteRemoveAria', language)}
            onclick={removeCustomPalette}
          >
            {te('editor.settings.removeAsset', language)}
          </Button>
        </div>
      {/if}
      {#each PALETTES as family (family)}
        {@const checked = !customPalette && palette === family}
        <!-- A family WAITS while the portfolio carries its own palette. That
             is said with a token, never with opacity: dimming the row would
             take its label under the contrast threshold, so only the
             decorative swatches fade and the text moves to --muted, which is
             AA on this ground. -->
        <label
          class="{ROW_CLASS} {checked
            ? 'border-primary bg-accent'
            : 'border-input bg-background'} {customPalette
            ? 'cursor-not-allowed'
            : 'cursor-pointer'}"
        >
          <RadioGroup.Item value={family} class="sr-only" disabled={customPalette !== undefined} />
          <!-- The dots preview THIS family, not the active one: the local
               data-palette re-scopes the --cat-* variables (palettes.css). -->
          <span
            class="flex flex-none gap-1 {customPalette ? 'opacity-45' : ''}"
            data-palette={family}
            aria-hidden="true"
          >
            {#each PREVIEW as color (color)}
              <span
                class="inline-block size-3 rounded-full shadow-[0_0_0_1px_rgb(0_0_0/0.08)]"
                style="background:{catColor(color)}"
              ></span>
            {/each}
          </span>
          <span
            class="{checked
              ? 'text-primary font-bold'
              : customPalette
                ? 'text-muted-foreground'
                : 'text-(--txt2)'} text-[12.5px]">{te(`editor.palette.${family}`, language)}</span
          >
        </label>
      {/each}
    </RadioGroup.Root>
    <p class="text-muted-foreground text-[11.5px]">
      {te(
        customPalette ? 'editor.settings.paletteApplies' : 'editor.settings.paletteHint',
        language,
      )}
    </p>
  </div>

  <!-- 2. Typeface: the family name, where it comes from, and the faces the
       portfolio carries itself. -->
  <div class="mb-4 flex flex-col gap-[7px]">
    <span class="text-(--txt2) text-[12.5px] font-semibold"
      >{te('editor.setting.font', language)}</span
    >
    <!-- Free text, three local sources and no fourth: a family bundled in
         this build, one deployed beside the app under `fonts/<family>/`, or
         one embedded in the portfolio below. No third party is ever asked. -->
    <FieldText
      {language}
      value={settings.theme.font}
      ariaLabel={te('editor.setting.font', language)}
      hint={te('editor.settings.fontHint', language)}
      error={fontError}
      commit={setFont}
    />
    <!-- The live verdict, always shown: where THIS family comes from, or that
         it comes from nowhere and the system stack takes over. aria-live
         announces the settled answer without stealing focus. -->
    <span class="text-[11.5px] font-semibold" aria-live="polite">
      {#if probeState === 'embedded'}
        <!-- The strongest source: the portfolio itself carries the faces — no
             deployment, no network, and the export inherits them. -->
        <span class="text-(--ok)">{te('editor.settings.fontProbe.embedded', language)}</span>
      {:else if probeState === 'bundled'}
        <span class="text-(--ok)">{te('editor.settings.fontProbe.bundled', language)}</span>
      {:else if probeState === 'served'}
        <span class="text-(--ok)"
          >{te('editor.settings.fontProbe.served', language, { family })}</span
        >
      {:else if probeState === 'missing'}
        <span class="text-(--vig-txt)"
          >{te('editor.settings.fontProbe.missing', language, { family })}</span
        >
      {:else}
        <span class="text-muted-foreground"
          >{te('editor.settings.fontProbe.unknown', language)}</span
        >
      {/if}
    </span>
    {#if deployable}
      <!-- The family could be served by this deployment: name the exact files
           it must carry, so a `missing` verdict is actionable. -->
      <span class="text-muted-foreground text-[11.5px]">
        {te('editor.settings.deployedFiles', language, { family })}
      </span>
    {/if}
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
              {te('editor.settings.removeAsset', language)}
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
  </div>

  <!-- 3. Logo: the organization's mark, inlined in the .json. -->
  <div class="flex flex-col gap-[7px]">
    <span class="text-(--txt2) text-[12.5px] font-semibold"
      >{te('editor.settings.logo', language)}</span
    >
    <div class="flex items-center gap-3.5">
      {#if identity.logo === undefined}
        <!-- EDITOR ONLY, and it goes no further: an empty frame says « there is
             no logo » where the deck simply draws nothing. Nothing is bundled
             to fall back on — a portfolio with no mark carries no mark. -->
        <p
          class="border-border text-muted-foreground flex h-11 w-[124px] items-center justify-center rounded-md border border-dashed text-[11.5px]"
        >
          {te('editor.settings.logoNone', language)}
        </p>
      {:else}
        <img
          class="border-border h-11 w-[124px] rounded-md border bg-white object-contain object-left px-2 py-1"
          src={identity.logo}
          alt=""
        />
      {/if}
      <div class="flex flex-col gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={readLogoFile === undefined}
          onclick={() => logoInput?.click()}
        >
          {te('editor.settings.logoImport', language)}
        </Button>
        {#if identity.logo !== undefined}
          <Button variant="outline" size="sm" onclick={resetLogo}>
            {te('editor.settings.logoReset', language)}
          </Button>
        {/if}
      </div>
    </div>
    <input
      bind:this={logoInput}
      type="file"
      accept="image/svg+xml,image/png,image/jpeg,image/webp"
      class="hidden"
      onchange={(e) => {
        void importLogo(e.currentTarget.files)
        e.currentTarget.value = ''
      }}
    />
    {#if logoError}
      <p class="text-destructive text-[11.5px]" role="alert">{logoError}</p>
    {:else}
      <p class="text-muted-foreground text-[11.5px]">{te('editor.settings.logoHint', language)}</p>
    {/if}
  </div>

  <!-- ONE licence line for the three: they raise the same question, and
       answering it three times would only make it easier to skip. -->
  <p class="text-muted-foreground border-border mt-3.5 border-t pt-3 text-[11.5px]">
    {te('editor.settings.assetsLicense', language)}
  </p>
</section>
