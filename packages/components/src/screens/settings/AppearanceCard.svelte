<script lang="ts">
  /** Appearance card: theme style, palette family, font and interface language. */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Language, PaletteFamily, ThemeStyle } from '@project-review/core/model/theme'
  import { LANGUAGES, PALETTES, THEME_STYLES } from '@project-review/core/model/theme'
  import type { Color } from '@project-review/core/model/category'
  import { catColor } from '../../commons/cat-color'
  import { te } from '../../i18n'
  import FieldText from '../../editor/FieldText.svelte'
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

<section class="card">
  <h2>{te('editor.settings.appearance', language)}</h2>

  <div class="field-group">
    <span class="label">{te('editor.setting.style', language)}</span>
    <div class="segmented" role="group" aria-label={te('editor.setting.style', language)}>
      {#each THEME_STYLES as candidate (candidate)}
        <button
          type="button"
          class:active={settings.theme.style === candidate}
          aria-pressed={settings.theme.style === candidate}
          onclick={() => setStyle(candidate)}
        >
          {te(`editor.style.${candidate}`, language)}
        </button>
      {/each}
    </div>
  </div>

  <div class="field-group">
    <span class="label">{te('editor.setting.palette', language)}</span>
    <div class="palette-radios">
      {#each PALETTES as family (family)}
        <label class="palette-option" class:checked={palette === family}>
          <input
            type="radio"
            name="palette"
            value={family}
            checked={palette === family}
            onchange={() => setPalette(family)}
          />
          <!-- The dots preview THIS family, not the active one: the local
               data-palette re-scopes the --cat-* variables (palettes.css). -->
          <span class="palette-dots" data-palette={family} aria-hidden="true">
            {#each PREVIEW as color (color)}
              <span class="pd" style="--c:{catColor(color)}"></span>
            {/each}
          </span>
          <span class="palette-name">{te(`editor.palette.${family}`, language)}</span>
        </label>
      {/each}
    </div>
  </div>

  <div class="field-group">
    <span class="label">{te('editor.setting.font', language)}</span>
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

  <div class="field-group" style="margin-bottom:0">
    <span class="label">{te('editor.setting.language', language)}</span>
    <div class="segmented" role="group" aria-label={te('editor.setting.language', language)}>
      {#each LANGUAGES as candidate (candidate)}
        <button
          type="button"
          class:active={language === candidate}
          aria-pressed={language === candidate}
          onclick={() => setLanguage(candidate)}
        >
          {candidate.toUpperCase()}
        </button>
      {/each}
    </div>
  </div>
</section>
