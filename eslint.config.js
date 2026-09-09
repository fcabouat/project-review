// Flat ESLint config: TypeScript + Svelte, calibrated to stay quiet on the
// established style (no-semicolon, single quotes are Prettier's business).
import tseslint from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'

/*
 * THE FLAT-CONFIG TRAP, spelled out once: for one rule key the LAST matching
 * block wins WHOLE — `no-restricted-imports` in a narrower block REPLACES the
 * wider block's, it does not extend it. Every narrower block below therefore
 * RESTATES the package-wide bans through these shared pattern fragments; a
 * fragment forgotten in a new block silently reopens the wider fence.
 */

/** The embeddable core imports NOTHING: no Svelte, no DOM helper, no sibling
 * workspace package, no view layer, no UI primitive kit. Restated in EVERY
 * core layer block. */
const CORE_EMBEDDABLE = {
  group: [
    'svelte',
    'svelte/**',
    '@project-review/**',
    'reveal.js',
    'reveal.js/**',
    'bits-ui',
    'bits-ui/**',
  ],
  message:
    '@project-review/core is embeddable: no Svelte, no dependency, no view layer (docs/overview.md).',
}

/** Components sit between core and the app: @project-review/core only — never
 * the app, never the browser adapters (by name or by relative escape). The
 * pure views receive what the adapters produce through props. Restated in
 * EVERY components sub-folder block. */
const COMPONENTS_ONLY_CORE = {
  group: [
    '@project-review/app',
    '@project-review/app/**',
    '**/app/src/**',
    '@project-review/infrastructure',
    '@project-review/infrastructure/**',
    '**/infrastructure/src/**',
  ],
  message: '@project-review/components may only import @project-review/core (docs/overview.md).',
}

/** One `no-restricted-imports` rule from pattern fragments. */
const restrict = (...patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
})

export default tseslint.config(
  {
    ignores: [
      'app/dist/',
      'app/dist-single/',
      'coverage/',
      'packages/components/storybook-static/',
      'docs/api/',
      'node_modules/',
      '_site/',
    ],
  },
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  // Layer boundaries (docs/overview.md) — the workspace manifests are the braces
  // (core declares no dependency, components and infrastructure only
  // @project-review/core, app all three), these path rules are the belt:
  // zero violations, engraved as-is.
  {
    files: ['packages/core/src/**'],
    rules: restrict(CORE_EMBEDDABLE),
  },
  // Within the core: model ← values; everything else ← model + values; never
  // the inverse. Expressed as "the lower layers may not reach up" — with the
  // package-wide ban restated in each block (see the trap note above).
  {
    files: ['packages/core/src/values/**'],
    rules: restrict(CORE_EMBEDDABLE, {
      group: [
        '**/model',
        '**/model/**',
        '**/data',
        '**/data/**',
        '**/parse',
        '**/parse/**',
        '**/commands',
        '**/commands/**',
        '**/events',
        '**/events/**',
        '**/projections',
        '**/projections/**',
        '**/services',
        '**/services/**',
        '**/runtime',
        '**/runtime/**',
      ],
      message: 'values/ is the bottom layer: it imports nothing above itself.',
    }),
  },
  {
    files: ['packages/core/src/model/**'],
    rules: restrict(CORE_EMBEDDABLE, {
      group: [
        '**/data',
        '**/data/**',
        '**/parse',
        '**/parse/**',
        '**/commands',
        '**/commands/**',
        '**/events',
        '**/events/**',
        '**/projections',
        '**/projections/**',
        '**/services',
        '**/services/**',
        '**/runtime',
        '**/runtime/**',
      ],
      message: 'model/ only rests on values/: parse, events and views come after it.',
    }),
  },
  {
    files: ['packages/core/src/data/**'],
    rules: restrict(CORE_EMBEDDABLE, {
      group: [
        '**/parse',
        '**/parse/**',
        '**/commands',
        '**/commands/**',
        '**/events',
        '**/events/**',
        '**/projections',
        '**/projections/**',
        '**/services',
        '**/services/**',
        '**/runtime',
        '**/runtime/**',
      ],
      message:
        'data/ is initialisation data: it speaks the model (and values), nothing further up.',
    }),
  },
  // Business services: the strict parse speaks only the model it targets; the
  // flat policies (persistence, portfolio-json) add the events they serialise.
  {
    files: ['packages/core/src/services/parse/**'],
    rules: restrict(CORE_EMBEDDABLE, {
      group: [
        '**/data',
        '**/data/**',
        '**/commands',
        '**/commands/**',
        '**/events',
        '**/events/**',
        '**/projections',
        '**/projections/**',
        '**/runtime',
        '**/runtime/**',
      ],
      message: 'services/parse rests on model + values alone.',
    }),
  },
  {
    files: ['packages/core/src/services/*.ts'],
    rules: restrict(CORE_EMBEDDABLE, {
      group: [
        '**/data',
        '**/data/**',
        '**/commands',
        '**/commands/**',
        '**/parse',
        '**/parse/**',
        '**/projections',
        '**/projections/**',
        '**/runtime',
        '**/runtime/**',
      ],
      message:
        'the flat services rest on model + values + events; the parse belongs to startup, projections to the views.',
    }),
  },
  // The persistence policy is the one flat service allowed to reach the parse:
  // a stored PortfolioReplaced embeds whole portfolios, and loadHistory replays
  // them through the strict parse before they may reach apply/invert.
  {
    files: ['packages/core/src/services/persistence.ts'],
    rules: restrict(CORE_EMBEDDABLE, {
      group: [
        '**/data',
        '**/data/**',
        '**/commands',
        '**/commands/**',
        '**/projections',
        '**/projections/**',
        '**/runtime',
        '**/runtime/**',
      ],
      message:
        'services/persistence rests on model + values + events + parse (revalidation of stored events).',
    }),
  },
  // i18n is the one flat service that READS data (the message tables) —
  // still nothing from the edit pipeline or the views.
  {
    files: ['packages/core/src/services/i18n.ts'],
    rules: restrict(CORE_EMBEDDABLE, {
      group: [
        '**/commands',
        '**/commands/**',
        '**/events',
        '**/events/**',
        '**/parse',
        '**/parse/**',
        '**/projections',
        '**/projections/**',
        '**/runtime',
        '**/runtime/**',
      ],
      message: 'services/i18n rests on the message tables (data/) and the model.',
    }),
  },
  // The abstract runtime orchestrates the edit pipeline — and NOTHING inside
  // the core imports the runtime back (only the outside world does).
  {
    files: ['packages/core/src/runtime/**'],
    rules: restrict(CORE_EMBEDDABLE, {
      group: [
        '**/data',
        '**/data/**',
        '**/services',
        '**/services/**',
        '**/projections',
        '**/projections/**',
      ],
      message:
        'runtime/ orchestrates model + values + commands + events; services plug in from the outside.',
    }),
  },
  {
    files: [
      'packages/core/src/commands/**',
      'packages/core/src/events/**',
      'packages/core/src/projections/**',
    ],
    rules: restrict(CORE_EMBEDDABLE, {
      group: ['**/runtime', '**/runtime/**'],
      message: 'nothing inside the core imports the runtime — only the outside world does.',
    }),
  },
  {
    files: ['packages/components/**'],
    rules: restrict(COMPONENTS_ONLY_CORE),
  },
  // Within components: screens/ is the top of the pile — the shared leaves
  // (commons, slides, editor, slideshow) never reach up into it.
  {
    files: ['packages/components/src/editor/**'],
    rules: restrict(COMPONENTS_ONLY_CORE, {
      group: ['**/screens', '**/screens/**'],
      message: 'screens/ composes the other sub-folders, never the reverse.',
    }),
  },
  // slides/ and commons/ are pure view leaves shared by the editor widgets and
  // the slideshow; neither reaches any shell.
  {
    files: ['packages/components/src/slides/**', 'packages/components/src/commons/**'],
    rules: restrict(COMPONENTS_ONLY_CORE, {
      group: [
        '**/editor',
        '**/editor/**',
        '**/slideshow',
        '**/slideshow/**',
        '**/screens',
        '**/screens/**',
      ],
      message:
        'slides/ and commons/ are pure view leaves: domain in, props in, nothing from the shells (docs/overview.md).',
    }),
  },
  {
    files: ['packages/components/src/slideshow/**'],
    rules: restrict(COMPONENTS_ONLY_CORE, {
      group: ['**/editor', '**/editor/**', '**/screens', '**/screens/**'],
      message:
        'The editor widgets host the slideshow, never the reverse; the deck is passed frozen (docs/overview.md).',
    }),
  },
  {
    files: ['packages/infrastructure/**'],
    rules: restrict({
      // Browser adapters behind the core's declared interfaces:
      // @project-review/core only — no view layer, no app (by name or by
      // relative escape). What comes from components (reveal options, engine
      // source) is INJECTED by the app at the seam, never imported here.
      group: [
        'svelte',
        'svelte/**',
        '@project-review/components',
        '@project-review/components/**',
        '**/components/src/**',
        '@project-review/app',
        '@project-review/app/**',
        '**/app/src/**',
      ],
      message:
        '@project-review/infrastructure may only import @project-review/core (docs/overview.md).',
    }),
  },
  {
    rules: {
      // The one documented assertion pattern (events.ts) stays; everything
      // else must justify itself.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // String-literal mustaches ({' · '}) are the project's idiom for exact
      // inter-block spacing in templates; the rule would trade them for
      // whitespace that Svelte may collapse.
      'svelte/no-useless-mustaches': 'off',
    },
  },
)
