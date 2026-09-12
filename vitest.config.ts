import { defineConfig } from 'vitest/config'

/**
 * Workspace test runner: one command, four projects (each package carries its
 * own project config). Coverage can only live here (root-level in projects
 * mode); the thresholds are keyed per package — LINES are pinned at the
 * measured 100 % (the README says so, the gate enforces it: one uncovered
 * line trips), BRANCHES stay a few points under their measured figure so a
 * regression trips early without freezing every ternary. Infrastructure's
 * DOM halves are exercised by the file:// smoke test (v8-ignored), app is
 * wiring only.
 */
export default defineConfig({
  test: {
    projects: ['packages/core', 'packages/components', 'packages/infrastructure', 'app'],
    coverage: {
      // Pure-TS perimeter only: Svelte components (DOM) are out of scope, as
      // are the entry point, the Storybook helpers and the test fixtures.
      include: ['packages/*/src/**/*.ts', 'app/src/**/*.ts'],
      exclude: [
        'app/src/main.ts',
        '**/story-*.ts',
        '**/*.stories.svelte',
        '**/tests/fixtures/**',
        '**/vite.config.ts',
        '**/vitest.config.ts',
        // Barrels of the vendored primitives: re-exports of .svelte files,
        // same DOM perimeter as the components themselves.
        '**/commons/ui/**/index.ts',
      ],
      thresholds: {
        'packages/core/src/**': { lines: 100, branches: 95 },
        'packages/components/src/**': { lines: 100, branches: 95 },
        'packages/infrastructure/src/**': { lines: 100, branches: 92 },
        'app/src/**': { lines: 100, branches: 88 },
      },
    },
  },
})
