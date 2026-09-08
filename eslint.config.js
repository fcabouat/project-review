// Flat ESLint config: TypeScript + Svelte, calibrated to stay quiet on the
// established style (no-semicolon, single quotes are Prettier's business).
import tseslint from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'

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
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // The embeddable core imports NOTHING: no Svelte, no DOM helper,
              // no sibling workspace package, no view layer.
              group: ['svelte', 'svelte/**', '@project-review/**', 'reveal.js', 'reveal.js/**'],
              message:
                '@project-review/core is embeddable: no Svelte, no dependency, no view layer (docs/overview.md).',
            },
          ],
        },
      ],
    },
  },
  // Within the core: model ← values; everything else ← model + values; never
  // the inverse. Expressed as "the lower layers may not reach up".
  {
    files: ['packages/core/src/values/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/model/**',
                '**/data/**',
                '**/parse/**',
                '**/commands/**',
                '**/events/**',
                '**/projections/**',
                '**/services/**',
                '**/runtime/**',
              ],
              message: 'values/ is the bottom layer: it imports nothing above itself.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/src/model/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/data/**',
                '**/parse/**',
                '**/commands/**',
                '**/events/**',
                '**/projections/**',
                '**/services/**',
                '**/runtime/**',
              ],
              message: 'model/ only rests on values/: parse, events and views come after it.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/src/data/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/parse/**',
                '**/commands/**',
                '**/events/**',
                '**/projections/**',
                '**/services/**',
                '**/runtime/**',
              ],
              message:
                'data/ is initialisation data: it speaks the model (and values), nothing further up.',
            },
          ],
        },
      ],
    },
  },
  // Business services: the strict parse speaks only the model it targets; the
  // flat policies (persistence, portfolio-json) add the events they serialise.
  {
    files: ['packages/core/src/services/parse/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/data/**',
                '**/commands/**',
                '**/events/**',
                '**/projections/**',
                '**/runtime/**',
              ],
              message: 'services/parse rests on model + values alone.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/src/services/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/data/**',
                '**/commands/**',
                '**/parse/**',
                '**/projections/**',
                '**/runtime/**',
              ],
              message:
                'the flat services rest on model + values + events; the parse belongs to startup, projections to the views.',
            },
          ],
        },
      ],
    },
  },
  // i18n is the one flat service that READS data (the message tables) —
  // still nothing from the edit pipeline or the views.
  {
    files: ['packages/core/src/services/i18n.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/commands/**',
                '**/events/**',
                '**/parse/**',
                '**/projections/**',
                '**/runtime/**',
              ],
              message: 'services/i18n rests on the message tables (data/) and the model.',
            },
          ],
        },
      ],
    },
  },
  // The abstract runtime orchestrates the edit pipeline — and NOTHING inside
  // the core imports the runtime back (only the outside world does).
  {
    files: ['packages/core/src/runtime/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/data/**', '**/services/**', '**/projections/**', '**/catalog/**'],
              message:
                'runtime/ orchestrates model + values + commands + events; services plug in from the outside.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'packages/core/src/commands/**',
      'packages/core/src/events/**',
      'packages/core/src/projections/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/runtime/**'],
              message: 'nothing inside the core imports the runtime — only the outside world does.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/components/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Components sit between core and the app: @project-review/core
              // only — never the app, never the browser adapters (by name or
              // by relative escape). The pure screens receive what the
              // adapters produce through props.
              group: [
                '@project-review/app',
                '@project-review/app/**',
                '**/app/src/**',
                '@project-review/infrastructure',
                '@project-review/infrastructure/**',
                '**/infrastructure/src/**',
              ],
              message:
                '@project-review/components may only import @project-review/core (docs/overview.md).',
            },
          ],
        },
      ],
    },
  },
  // Within components: screens/ is the top of the pile — the shared leaves
  // (commons, slides, editor, slideshow) never reach up into it. NOTE: for the
  // same rule key, the LAST matching flat-config block wins whole — so every
  // narrower components block below restates the package-wide bans.
  {
    files: ['packages/components/src/commons/**', 'packages/components/src/editor/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@project-review/app',
                '@project-review/app/**',
                '**/app/src/**',
                '@project-review/infrastructure',
                '@project-review/infrastructure/**',
                '**/infrastructure/src/**',
              ],
              message:
                '@project-review/components may only import @project-review/core (docs/overview.md).',
            },
            {
              group: ['**/screens', '**/screens/**'],
              message:
                'screens/ composes the other sub-folders, never the reverse (internal/conventions.md).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/infrastructure/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Browser adapters behind the core's seams: @project-review/core
              // only — no view layer, no app (by name or by relative escape).
              // What comes from components (reveal options) is INJECTED by the
              // app at the seam, never imported here.
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
            },
          ],
        },
      ],
    },
  },
  // Within components: slides/ and ui/ are pure view leaves shared by the
  // editor widgets and the slideshow; the slideshow never reaches editor/.
  {
    files: ['packages/components/src/slides/**', 'packages/components/src/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@project-review/app',
                '@project-review/app/**',
                '**/app/src/**',
                '@project-review/infrastructure',
                '@project-review/infrastructure/**',
                '**/infrastructure/src/**',
              ],
              message:
                '@project-review/components may only import @project-review/core (docs/overview.md).',
            },
            {
              group: [
                '**/editor',
                '**/editor/**',
                '**/slideshow',
                '**/slideshow/**',
                '**/screens',
                '**/screens/**',
              ],
              message:
                'slides/ and ui/ are pure view leaves: domain in, props in, nothing from the shells (docs/overview.md).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/components/src/slideshow/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@project-review/app',
                '@project-review/app/**',
                '**/app/src/**',
                '@project-review/infrastructure',
                '@project-review/infrastructure/**',
                '**/infrastructure/src/**',
              ],
              message:
                '@project-review/components may only import @project-review/core (docs/overview.md).',
            },
            {
              group: ['**/editor', '**/editor/**', '**/screens', '**/screens/**'],
              message:
                'The editor widgets host the slideshow, never the reverse; the deck is passed frozen (docs/overview.md).',
            },
          ],
        },
      ],
    },
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
