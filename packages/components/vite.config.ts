/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Serves two masters: Storybook (which merges this config) and the
// `components` vitest project of the root workspace config.
export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  test: {
    name: 'components',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
