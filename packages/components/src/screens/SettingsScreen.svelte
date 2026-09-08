<script lang="ts">
  /**
   * E0b — settings: appearance (palette, font, language), aggregate slides,
   * categories (CRUD + reorder) and free slides.
   *
   * Every control emits a `ChangeSetting` / category command, so switching the
   * language or the palette is undoable like any other edit. `decide` reads the
   * `before` and drops the scalar no-ops — no guard needed here.
   *
   * Pure screen: `portfolio`, `dispatch` and the optional local-save switch in
   * — no store, no router, no infrastructure (screens contract, `contracts.ts`).
   */
  import type { Portfolio } from '@project-review/core/model/portfolio'
  import type { Category } from '@project-review/core/model/category'
  import type { Language, PaletteFamily, ThemeStyle } from '@project-review/core/model/theme'
  import { COLORS } from '@project-review/core/model/category'
  import { LANGUAGES, THEME_STYLES } from '@project-review/core/model/theme'
  import type { Color } from '@project-review/core/model/category'
  import { catColor } from '../commons/cat-color'
  import { isTracked, projectsOfCategory } from '@project-review/core/projections'
  import { LOGO_MAX_CHARS, parsePortfolio } from '@project-review/core/services/parse'
  import { emptyPortfolio } from '@project-review/core/data/empty-portfolio'
  import sampleFr from '@project-review/core/samples/sample-portfolio.fr.json'
  import sampleEn from '@project-review/core/samples/sample-portfolio.en.json'
  import { nextCategoryId } from '@project-review/core/values/ids'
  import type { IdentityField } from '@project-review/core/events'
  import { te } from '../i18n'
  import FieldText from '../editor/FieldText.svelte'
  import FieldSwitch from '../editor/FieldSwitch.svelte'
  import FreeSlideCard from '../editor/FreeSlideCard.svelte'
  import Icon from '../commons/Icon.svelte'
  import SlidePreviewDialog from '../editor/SlidePreviewDialog.svelte'
  import { portfolioWarnings } from '../editor/validation'
  import type { Dispatch, PersistenceControl } from './contracts'
  import defaultLogo from '../assets/logo-dejavu.svg'

  interface Props {
    readonly portfolio: Portfolio
    readonly dispatch: Dispatch
    /** Local-save switch; absent → the row is not shown. */
    readonly persistence?: PersistenceControl
  }

  let { portfolio, dispatch, persistence }: Props = $props()

  let editingCategoryId = $state<string | undefined>(undefined)
  /** Mounted only while open: a closed preview renders no slide at all (E2ter). */
  let previewCategory = $state<Category | undefined>(undefined)

  const settings = $derived(portfolio.settings)
  const identity = $derived(settings.identity)
  const language = $derived(settings.language)
  const palette = $derived(settings.theme.palette)
  const warnings = $derived(portfolioWarnings(portfolio))

  /** Global replacement (purge, samples, reset) — undoable like everything else. */
  function replace(next: Portfolio): void {
    dispatch({ type: 'ReplacePortfolio', portfolio: next })
  }

  /** One identity field ↔ one `ChangeIdentityField`, at blur (contract v2). */
  function setIdentity(field: Exclude<IdentityField, 'logo'>, next: string | undefined): void {
    dispatch({ type: 'ChangeIdentityField', field, after: next } as never)
  }

  /* ---- inline logo (data URI in the JSON, bundled Déjà Vu fallback) ---- */

  let logoInput = $state<HTMLInputElement | undefined>()
  let logoError = $state<string | undefined>(undefined)

  function importLogo(files: FileList | null): void {
    logoError = undefined
    const file = files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onerror = () => (logoError = te('editor.settings.logoUnreadable', language))
    reader.onload = () => {
      const uri = typeof reader.result === 'string' ? reader.result : undefined
      if (!uri || !uri.startsWith('data:image/')) {
        logoError = te('editor.settings.logoUnreadable', language)
        return
      }
      if (uri.length > LOGO_MAX_CHARS) {
        logoError = te('editor.settings.logoTooBig', language)
        return
      }
      dispatch({ type: 'ChangeIdentityField', field: 'logo', after: uri })
    }
    reader.readAsDataURL(file)
  }

  function resetLogo(): void {
    logoError = undefined
    dispatch({ type: 'ChangeIdentityField', field: 'logo', after: undefined })
  }

  function setStyle(after: ThemeStyle): void {
    dispatch({ type: 'ChangeSetting', setting: 'style', after })
  }

  /* ---- data administration (contract v2) — all UNDOABLE replacements ---- */

  /** Content emptied, review and settings kept: the "organization kit" state. */
  function purge(): void {
    if (!window.confirm(te('editor.data.purgeConfirm', language))) return
    replace({ ...portfolio, categories: [], projects: [], freeSlides: [] })
  }

  /** The bundled sample set of the current language, as a full replacement. */
  function loadExamples(): void {
    if (!window.confirm(te('editor.data.examplesConfirm', language))) return
    const parsed = parsePortfolio(language === 'en' ? sampleEn : sampleFr)
    if (!parsed.ok) return
    replace(parsed.portfolio)
  }

  /** Theme and display back to the defaults; language and identity are kept. */
  function resetSettings(): void {
    if (!window.confirm(te('editor.data.resetSettingsConfirm', language))) return
    const defaults = emptyPortfolio(language, portfolio.review.reviewDate).settings
    replace({
      ...portfolio,
      settings: { ...defaults, language: language, identity: settings.identity },
    })
  }

  function togglePersist(enabled: boolean): void {
    if (!persistence) return
    if (!enabled && !window.confirm(te('editor.data.persistOffConfirm', language))) return
    persistence.toggle(enabled)
  }

  /**
   * Flattened settings path: one key, one command. Narrow helpers rather
   * than one generic writer — the `setting ↔ value` correlation is exactly what
   * a single signature cannot express; here the types simply stay honest per
   * group.
   */
  function setShow(setting: keyof typeof settings.show, after: boolean): void {
    dispatch({ type: 'ChangeSetting', setting, after })
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

  function setRecapLines(after: number): void {
    // UI clamp — the steppers stop at the bounds; `decide` drops the no-ops.
    if (after < 6 || after > 16) return
    dispatch({ type: 'ChangeSetting', setting: 'recapRows', after })
  }

  /** The four dots of a palette preview — a sample, not the whole family. */
  const PREVIEW: readonly Color[] = ['blue', 'teal', 'green', 'red']

  /** Display order: the default family comes first. */
  const PALETTE_ORDER: readonly PaletteFamily[] = ['material', 'tailwind', 'dsfr']

  function usage(category: Category): number {
    return projectsOfCategory(portfolio, category.id).length
  }

  /** "3 projets" / "1 projet" — the count never shows as a bare number. */
  function usageLabel(category: Category): string {
    const n = usage(category)
    return n === 1
      ? te('editor.settings.categoryUsageOne', language)
      : te('editor.settings.categoryUsage', language, { n })
  }

  /** A category with no tracked project emits no divider at all. */
  function hasDivider(category: Category): boolean {
    return projectsOfCategory(portfolio, category.id).some(isTracked)
  }

  /** Divider numbering counts only the categories that actually emit one. */
  function dividerNumber(category: Category): number {
    return portfolio.categories.filter(hasDivider).indexOf(category) + 1
  }

  function addCategory(): void {
    const used = new Set(portfolio.categories.map((c) => c.color))
    const color = COLORS.find((c) => !used.has(c)) ?? 'taupe'
    const category: Category = {
      id: nextCategoryId(portfolio.categories),
      name: te('editor.settings.newCategory', language),
      color,
    }
    dispatch({ type: 'CreateCategory', category, index: portfolio.categories.length })
    editingCategoryId = category.id
  }

  function move(category: Category, delta: number): void {
    const from = portfolio.categories.indexOf(category)
    const to = from + delta
    // UI clamp — the arrows are disabled at the ends; `decide` drops from === to.
    if (to < 0 || to >= portfolio.categories.length) return
    dispatch({ type: 'MoveCategory', id: category.id, to })
  }

  const freeSlides = $derived(portfolio.freeSlides)
</script>

<div class="settings-grid">
  <div class="settings-col">
    <section class="card">
      <h2>{te('editor.review.identity', language)}</h2>
      <FieldText
        {language}
        label={te('editor.field.org', language)}
        value={identity.org}
        commit={(v) => setIdentity('org', v)}
      />
      <FieldText
        {language}
        label={te('editor.field.unit', language)}
        value={identity.unit}
        commit={(v) => setIdentity('unit', v)}
      />
      <FieldText
        {language}
        label={te('editor.field.orgLong', language)}
        value={identity.orgLong}
        commit={(v) => setIdentity('orgLong', v)}
      />
      <FieldText
        {language}
        label={te('editor.field.unitLong', language)}
        value={identity.unitLong}
        commit={(v) => setIdentity('unitLong', v)}
      />
      <FieldText
        {language}
        label={te('editor.field.contact', language)}
        value={identity.contact}
        commit={(v) => setIdentity('contact', v)}
      />

      <div class="field-group" style="margin-bottom:0">
        <span class="label">{te('editor.settings.logo', language)}</span>
        <div class="logo-row">
          <img class="logo-preview" src={identity.logo ?? defaultLogo} alt="" />
          <div class="logo-actions">
            <button
              class="btn btn-secondary btn-sm"
              type="button"
              onclick={() => logoInput?.click()}
            >
              {te('editor.settings.logoImport', language)}
            </button>
            {#if identity.logo !== undefined}
              <button class="btn btn-secondary btn-sm" type="button" onclick={resetLogo}>
                {te('editor.settings.logoReset', language)}
              </button>
            {/if}
          </div>
        </div>
        <input
          bind:this={logoInput}
          type="file"
          accept="image/svg+xml,image/png,image/jpeg,image/webp"
          style="display:none"
          onchange={(e) => importLogo(e.currentTarget.files)}
        />
        {#if logoError}
          <p class="hint" role="alert" style="color:var(--err, #dc2626)">{logoError}</p>
        {:else}
          <p class="hint">{te('editor.settings.logoHint', language)}</p>
        {/if}
      </div>
    </section>

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
          {#each PALETTE_ORDER as family (family)}
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
        <!-- Free text: "Marianne" (bundled faces if the woff2 files are deployed),
             or any Google Fonts family, loaded on demand (phase 7). -->
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

    <section class="card">
      <h2>{te('editor.settings.aggregates', language)}</h2>
      <FieldSwitch
        label={te('editor.setting.healthDashboard', language)}
        checked={settings.show.healthDashboard}
        commit={(v) => setShow('healthDashboard', v)}
      />
      <FieldSwitch
        label={te('editor.setting.recap', language)}
        checked={settings.show.recap}
        commit={(v) => setShow('recap', v)}
      />
      <FieldSwitch
        label={te('editor.setting.archives', language)}
        checked={settings.show.archives}
        commit={(v) => setShow('archives', v)}
      />
      <FieldSwitch
        label={te('editor.setting.decisions', language)}
        checked={settings.show.decisions}
        commit={(v) => setShow('decisions', v)}
      />
      <div class="stepper-row">
        <span>{te('editor.setting.recapRows', language)}</span>
        <span class="stepper">
          <button
            type="button"
            aria-label={te('editor.settings.decrease', language)}
            disabled={settings.recapRows <= 6}
            onclick={() => setRecapLines(settings.recapRows - 1)}>−</button
          >
          <span class="val">{settings.recapRows}</span>
          <button
            type="button"
            aria-label={te('editor.settings.increase', language)}
            disabled={settings.recapRows >= 16}
            onclick={() => setRecapLines(settings.recapRows + 1)}>+</button
          >
        </span>
      </div>
    </section>

    <section class="card">
      <h2>{te('editor.nav.data', language)}</h2>
      {#if persistence}
        <FieldSwitch
          label={te('editor.data.persist', language)}
          checked={persistence.enabled}
          commit={togglePersist}
        />
        <p class="hint">{te('editor.data.persistHint', language)}</p>
      {/if}
      <div class="data-actions">
        <button class="btn btn-secondary btn-sm" type="button" onclick={loadExamples}>
          {te('editor.data.examples', language)}
        </button>
        <button class="btn btn-secondary btn-sm" type="button" onclick={resetSettings}>
          {te('editor.data.resetSettings', language)}
        </button>
        <button class="btn btn-secondary btn-sm btn-danger" type="button" onclick={purge}>
          {te('editor.data.purge', language)}
        </button>
      </div>
      <p class="hint">{te('editor.data.undoHint', language)}</p>
    </section>
  </div>

  <div class="settings-col">
    <section class="card">
      <h2>{te('editor.settings.categories', language)}</h2>

      {#if warnings.length > 0}
        <ul class="softcheck">
          {#each warnings as warning, i (i)}
            <li>{te(warning.key, language, warning.slots)}</li>
          {/each}
        </ul>
      {/if}

      {#each portfolio.categories as category, index (category.id)}
        <div class="catrow">
          <span class="cat-dot" style="--c:{catColor(category.color)}" aria-hidden="true"></span>
          <span class="cname truncate">{category.name}</span>
          <span class="ccount">{usageLabel(category)}</span>
          <button
            class="icon-btn"
            type="button"
            title={te('editor.projects.moveUp', language)}
            aria-label="{te('editor.projects.moveUp', language)} {category.name}"
            disabled={index === 0}
            onclick={() => move(category, -1)}><span class="glyph-rot-up">▸</span></button
          >
          <button
            class="icon-btn"
            type="button"
            title={te('editor.projects.moveDown', language)}
            aria-label="{te('editor.projects.moveDown', language)} {category.name}"
            disabled={index === portfolio.categories.length - 1}
            onclick={() => move(category, 1)}><span class="glyph-rot-down">▸</span></button
          >
          <button
            class="icon-btn"
            type="button"
            title={te('editor.projects.edit', language)}
            aria-label="{te('editor.projects.edit', language)} {category.name}"
            onclick={() =>
              (editingCategoryId = editingCategoryId === category.id ? undefined : category.id)}
            >✎</button
          >
          <button
            class="icon-btn"
            type="button"
            title={te('editor.preview.open', language)}
            aria-label="{te('editor.preview.open', language)} {category.name}"
            disabled={!hasDivider(category)}
            onclick={() => (previewCategory = category)}><Icon name="eye-line" /></button
          >
          <button
            class="icon-btn"
            type="button"
            title={usage(category) > 0
              ? te('editor.settings.deleteBlocked', language, { n: usage(category) })
              : te('editor.projects.delete', language)}
            aria-label="{te('editor.projects.delete', language)} {category.name}"
            disabled={usage(category) > 0}
            onclick={() => dispatch({ type: 'DeleteCategory', id: category.id })}>✕</button
          >
        </div>

        {#if editingCategoryId === category.id}
          <div class="cat-popover">
            <FieldText
              {language}
              label={te('editor.field.name', language)}
              value={category.name}
              commit={(v) =>
                dispatch({
                  type: 'RenameCategory',
                  id: category.id,
                  after: v ?? category.name,
                })}
            />
            <span class="pop-label">{te('editor.settings.color', language)}</span>
            <div class="swatchgrid">
              {#each COLORS as color (color)}
                <!-- The ADT value ("lightGreen"-style code) never shows raw:
                     the swatch speaks the catalog's language. -->
                <button
                  type="button"
                  class="swatch"
                  class:selected={category.color === color}
                  aria-pressed={category.color === color}
                  title={te(`editor.color.${color}`, language)}
                  onclick={() =>
                    dispatch({ type: 'RecolorCategory', id: category.id, after: color })}
                >
                  <span class="swatch-dot" style="--c:{catColor(color)}"></span>
                  {te(`editor.color.${color}`, language)}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}

      <button
        class="btn btn-secondary btn-sm"
        type="button"
        style="width:100%;justify-content:center;margin-top:12px"
        onclick={addCategory}>{te('editor.settings.add', language)}</button
      >
    </section>

    <section class="card">
      <h2>{te('editor.settings.freeSlides', language)}</h2>
      {#each freeSlides as slide (slide.id)}
        <FreeSlideCard {portfolio} {dispatch} {slide} />
      {:else}
        <p class="hint">{te('editor.review.noFreeSlide', language)}</p>
      {/each}
    </section>
  </div>
</div>

{#if previewCategory}
  <SlidePreviewDialog
    {portfolio}
    slide={{
      type: 'divider',
      categoryId: previewCategory.id,
      number: dividerNumber(previewCategory),
    }}
    subject={te('editor.preview.subject.divider', language, { name: previewCategory.name })}
    close={() => (previewCategory = undefined)}
  />
{/if}
