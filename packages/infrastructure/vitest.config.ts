import { defineConfig } from 'vitest/config'

// One of the four projects the root `vitest.config.ts` aggregates.
// Coverage is a root-level concern (per-package thresholds live there).
export default defineConfig({
  test: {
    name: 'infrastructure',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
