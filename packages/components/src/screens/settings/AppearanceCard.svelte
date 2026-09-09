<script lang="ts">
  /** Appearance card: theme style, palette family, font and interface language. */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Language, PaletteFamily, ThemeStyle } from '@project-review/core/model/theme'
  import { LANGUAGES, PALETTES, THEME_STYLES } from '@project-review/core/model/theme'
  import type { Color } from '@project-review/core/model/category'
  import { catColor } from '../../commons/cat-color'
  import { te } from '../../i18n'
  import FieldText from '../../editor/FieldText.svelte'
  import FieldSegmented from '../../editor/FieldSegmented.svelte'
  import * as RadioGroup from '../../commons/ui/radio-group'
  import type { Dispatch } from '../contracts'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
  }

  let { portfolio, dispatch }: Props = $props()

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
            : 'border-input bg-white'} has-[:focus-visible]:outline-ring relative flex cursor-pointer items-center gap-[9px] rounded-[7px] border px-2.5 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1"
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
