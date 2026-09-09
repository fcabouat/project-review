<script lang="ts">
  /**
   * Appearance card: slide theme style, reader scheme, palette family, font
   * and interface language. The scheme picker is the ONE control here that
   * does not dispatch: the scheme is a reader preference the host wires in
   * (`AppearanceControl`), never a portfolio setting — see the contract.
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Language, PaletteFamily, ThemeStyle } from '@project-review/core/model/theme'
  import { LANGUAGES, PALETTES, THEME_STYLES } from '@project-review/core/model/theme'
  import type { Color } from '@project-review/core/model/category'
  import { catColor } from '../../commons/cat-color'
  import { te } from '../../i18n'
  import FieldText from '../../editor/FieldText.svelte'
  import FieldSegmented from '../../editor/FieldSegmented.svelte'
  import * as RadioGroup from '../../commons/ui/radio-group'
  import type { AppearanceControl, ColorScheme, Dispatch, FontStatus } from '../contracts'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    /** Reader scheme picker; absent (a bare story) → the row is not shown. */
    readonly appearance?: AppearanceControl
    /** Live verdict on the locally served font — the host probes, the card
     * only tells; absent, the card stays on the calm `unknown` wording. */
    readonly fontStatus?: FontStatus
  }

  let { portfolio, dispatch, appearance, fontStatus }: Props = $props()

  const SCHEMES: readonly ColorScheme[] = ['system', 'light', 'dark']

  /** The one family served from the deployment rather than bundled/fetched:
   * only for it do the expected files and the live verdict appear. */
  const marianne = $derived(portfolio.settings.theme.font.trim() === 'Marianne')
  const probeState = $derived(fontStatus ?? 'unknown')

  const settings = $derived(portfolio.settings)
  const language = $derived(settings.language)
  const palette = $derived(settings.theme.palette)

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
    {#if marianne}
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
