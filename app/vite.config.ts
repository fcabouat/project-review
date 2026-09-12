/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { engineSourceAlias } from './vite.shared.ts'

// Static-hosting build (relative base); the file:// deliverable is build:single.
export default defineConfig({
  base: './',
  resolve: { alias: [engineSourceAlias] },
  plugins: [svelte(), tailwindcss()],
  build: {
    // Deliverables land at the repo root: dist/ is the product of the whole
    // workspace, not an implementation detail of app/. emptyOutDir must be
    // explicit — Vite refuses to clear a directory outside its own root.
    outDir: '../dist',
    emptyOutDir: true,
  },
  test: {
    name: 'app',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
