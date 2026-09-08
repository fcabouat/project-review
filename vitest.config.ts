import { defineConfig } from 'vitest/config'

/**
 * Workspace test runner: one command, four projects (each package carries its
 * own project config). Coverage can only live here (root-level in projects
 * mode); the thresholds are keyed per package, calibrated ~2 points under the
 * measured coverage so a regression trips early — core keeps the strictest
 * bar, components has few testable .ts files (the Svelte components are out of
 * scope), infrastructure's DOM halves are exercised by the file:// smoke test
 * (v8-ignored), app is wiring only.
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
      ],
      thresholds: {
        'packages/core/src/**': { lines: 98, branches: 95 },
        'packages/components/src/**': { lines: 98, branches: 95 },
        'packages/infrastructure/src/**': { lines: 98, branches: 92 },
        'app/src/**': { lines: 98, branches: 88 },
      },
    },
  },
})
