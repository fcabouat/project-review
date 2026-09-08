/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Static-hosting build (relative base); the file:// deliverable is build:single.
export default defineConfig({
  base: './',
  plugins: [svelte(), tailwindcss()],
  test: {
    name: 'app',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
