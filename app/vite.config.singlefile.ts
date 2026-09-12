/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vite'

/**
 * Single-file build: one self-contained HTML that
 * works from file:// — no module fetch, no lazy chunk (reveal is folded in by
 * the single-file plugin's code-splitting setting), assets inlined. The classic build (repo-root dist/)
 * remains the static-hosting one; this one is the "double-click" deliverable,
 * packaged into dist/ as well by build:package.
 */
export default defineConfig({
  base: './',
  plugins: [svelte(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 5_000,
  },
})
